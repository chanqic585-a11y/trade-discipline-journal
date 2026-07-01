import { PythonMarketFeatures, PythonTradeContextFeatures, Trade } from '../types';
import { requestMarketApi, toCcxtSymbol } from './marketDataService';

const DEFAULT_FEATURE_TIMEFRAME = '1h';
const DEFAULT_FEATURE_LIMIT = 200;

function isPythonFeatureSource(value: unknown): value is 'python_feature_engine_v5' {
  return value === 'python_feature_engine_v5';
}

function isMarketFeatureResponse(value: PythonMarketFeatures | null): value is PythonMarketFeatures {
  return Boolean(value && isPythonFeatureSource(value.source));
}

function isTradeContextFeatureResponse(
  value: PythonTradeContextFeatures | null,
): value is PythonTradeContextFeatures {
  return Boolean(value && isPythonFeatureSource(value.source));
}

export async function fetchPythonMarketFeatures(
  symbol: string,
  marketType: Trade['marketType'],
  timeframe = DEFAULT_FEATURE_TIMEFRAME,
  limit = DEFAULT_FEATURE_LIMIT,
) {
  const response = await requestMarketApi<PythonMarketFeatures>('/features/market', {
    exchange: 'okx',
    symbol: toCcxtSymbol(symbol, marketType),
    timeframe,
    limit,
  });

  return isMarketFeatureResponse(response) ? response : null;
}

export async function fetchPythonTradeContextFeatures(
  trade: Trade,
  timeframe = DEFAULT_FEATURE_TIMEFRAME,
  limit = DEFAULT_FEATURE_LIMIT,
) {
  const response = await requestMarketApi<PythonTradeContextFeatures>('/features/trade-context', {
    exchange: 'okx',
    symbol: toCcxtSymbol(trade.symbol, trade.marketType),
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    timeframe,
    limit,
  });

  return isTradeContextFeatureResponse(response) ? response : null;
}
