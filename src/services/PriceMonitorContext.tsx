import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { createAlertLog, hasAlertLog, listAlertLogs, listMonitorableTrades } from '../db/repositories';
import { fetchBackendTicker } from './marketDataService';
import { sendPriceAlertNotification } from './notifications';
import { evaluatePriceTrigger, toOkxInstrumentId } from './priceAlerts';
import { AlertLog, Trade } from '../types';

const OKX_PUBLIC_WS_URL = 'wss://ws.okx.com:8443/ws/v5/public';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface OkxTickerMessage {
  event?: string;
  msg?: string;
  data?: Array<{
    instId: string;
    last: string;
  }>;
}

interface PriceMonitorState {
  status: ConnectionStatus;
  trades: Trade[];
  prices: Record<string, number>;
  logs: AlertLog[];
}

const PriceMonitorContext = createContext<PriceMonitorState>({
  status: 'idle',
  trades: [],
  prices: {},
  logs: [],
});

export function PriceMonitorProvider({ refreshKey, children }: { refreshKey: number; children: ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const manuallyClosedRef = useRef(false);
  const triggeredKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([listMonitorableTrades(), listAlertLogs()])
      .then(([nextTrades, nextLogs]) => {
        setTrades(nextTrades);
        setLogs(nextLogs);
      })
      .catch(console.error);
  }, [refreshKey]);

  const instrumentIds = useMemo(
    () => Array.from(new Set(trades.map((trade) => toOkxInstrumentId(trade.symbol, trade.marketType)))),
    [trades],
  );

  const recordTrigger = useCallback(async (trade: Trade, currentPrice: number) => {
    const trigger = evaluatePriceTrigger(trade, currentPrice);
    if (!trigger) return;

    const key = `${trade.id}:${trigger.alertType}`;
    if (triggeredKeysRef.current.has(key)) return;
    triggeredKeysRef.current.add(key);

    const alreadyLogged = await hasAlertLog(trade.id, trigger.alertType);
    if (alreadyLogged) return;

    await createAlertLog({
      tradeId: trade.id,
      symbol: trade.symbol,
      alertType: trigger.alertType,
      triggerPrice: trigger.triggerPrice,
      currentPrice,
      message: trigger.message,
    });

    const title = trigger.alertType === 'stop_loss' ? '止损提醒' : '止盈提醒';
    const body = `${trade.symbol} 当前价 ${currentPrice.toFixed(6)}，触发价 ${trigger.triggerPrice.toFixed(6)}。`;
    await sendPriceAlertNotification(title, `${body} ${trigger.message}`);
    Alert.alert(title, `${body}\n\n${trigger.message}`);
    setLogs(await listAlertLogs());
  }, []);

  const handleTickerPrice = useCallback(
    (instrumentId: string, currentPrice: number) => {
      setPrices((current) => ({ ...current, [instrumentId]: currentPrice }));
      trades
        .filter((trade) => toOkxInstrumentId(trade.symbol, trade.marketType) === instrumentId)
        .forEach((trade) => {
          recordTrigger(trade, currentPrice).catch(console.error);
        });
    },
    [recordTrigger, trades],
  );

  useEffect(() => {
    if (trades.length === 0) return;

    let isMounted = true;

    Promise.all(
      trades.map(async (trade) => {
        const ticker = await fetchBackendTicker(trade.symbol, trade.marketType);
        if (!ticker?.price) return null;

        return {
          currentPrice: ticker.price,
          instrumentId: toOkxInstrumentId(trade.symbol, trade.marketType),
          trade,
        };
      }),
    )
      .then((results) => {
        if (!isMounted) return;

        const backendPrices: Record<string, number> = {};
        results.forEach((result) => {
          if (!result) return;
          backendPrices[result.instrumentId] = result.currentPrice;
          recordTrigger(result.trade, result.currentPrice).catch(console.error);
        });

        if (Object.keys(backendPrices).length > 0) {
          setPrices((current) => ({ ...current, ...backendPrices }));
        }
      })
      .catch(console.error);

    return () => {
      isMounted = false;
    };
  }, [recordTrigger, trades]);

  useEffect(() => {
    manuallyClosedRef.current = false;

    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    socketRef.current?.close();
    socketRef.current = null;

    if (instrumentIds.length === 0) {
      setStatus('idle');
      return () => undefined;
    }

    const connect = () => {
      setStatus((current) => (current === 'idle' ? 'connecting' : 'reconnecting'));
      const socket = new WebSocket(OKX_PUBLIC_WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus('connected');
        socket.send(
          JSON.stringify({
            op: 'subscribe',
            args: instrumentIds.map((instId) => ({ channel: 'tickers', instId })),
          }),
        );

        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('ping');
        }, 25000);
      };

      socket.onmessage = (event: { data: string }) => {
        if (event.data === 'pong') return;
        try {
          const message = JSON.parse(event.data) as OkxTickerMessage;
          if (message.event === 'error') {
            console.warn(message.msg ?? 'OKX WebSocket error');
            setStatus('error');
            return;
          }

          message.data?.forEach((ticker) => {
            const last = Number(ticker.last);
            if (Number.isFinite(last) && last > 0) handleTickerPrice(ticker.instId, last);
          });
        } catch (error) {
          console.warn(error);
        }
      };

      socket.onerror = () => {
        setStatus('error');
      };

      socket.onclose = () => {
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        if (!manuallyClosedRef.current) {
          setStatus('reconnecting');
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      manuallyClosedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      socketRef.current?.close();
    };
  }, [handleTickerPrice, instrumentIds]);

  return (
    <PriceMonitorContext.Provider value={{ logs, prices, status, trades }}>
      {children}
    </PriceMonitorContext.Provider>
  );
}

export function usePriceMonitor() {
  return useContext(PriceMonitorContext);
}
