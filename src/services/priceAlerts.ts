import { AlertType, Trade } from '../types';

export interface PriceTriggerResult {
  alertType: AlertType;
  triggerPrice: number;
  message: string;
}

export interface PriceDistance {
  stopLossPercent: number;
  takeProfitPercent: number | null;
}

export function evaluatePriceTrigger(trade: Trade, currentPrice: number): PriceTriggerResult | null {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;

  if (trade.direction === 'long') {
    if (currentPrice <= trade.stopLossPrice) {
      return {
        alertType: 'stop_loss',
        triggerPrice: trade.stopLossPrice,
        message: `${trade.symbol} 已触及止损价，请先执行纪律动作并记录结果。`,
      };
    }

    if (trade.takeProfitPrice !== null && currentPrice >= trade.takeProfitPrice) {
      return {
        alertType: 'take_profit',
        triggerPrice: trade.takeProfitPrice,
        message: `${trade.symbol} 已触及止盈价，请按计划处理并完成复盘。`,
      };
    }
  }

  if (trade.direction === 'short') {
    if (currentPrice >= trade.stopLossPrice) {
      return {
        alertType: 'stop_loss',
        triggerPrice: trade.stopLossPrice,
        message: `${trade.symbol} 已触及止损价，请先执行纪律动作并记录结果。`,
      };
    }

    if (trade.takeProfitPrice !== null && currentPrice <= trade.takeProfitPrice) {
      return {
        alertType: 'take_profit',
        triggerPrice: trade.takeProfitPrice,
        message: `${trade.symbol} 已触及止盈价，请按计划处理并完成复盘。`,
      };
    }
  }

  return null;
}

export function calculatePriceDistance(trade: Trade, currentPrice: number): PriceDistance {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return {
      stopLossPercent: 0,
      takeProfitPercent: trade.takeProfitPrice === null ? null : 0,
    };
  }

  return {
    stopLossPercent: (Math.abs(currentPrice - trade.stopLossPrice) / currentPrice) * 100,
    takeProfitPercent:
      trade.takeProfitPrice === null
        ? null
        : (Math.abs(currentPrice - trade.takeProfitPrice) / currentPrice) * 100,
  };
}

export function toOkxInstrumentId(symbol: string, marketType: Trade['marketType']) {
  const normalized = symbol.trim().toUpperCase();
  if (normalized.includes('-')) return normalized;
  if (marketType === 'futures') return `${normalized}-USDT-SWAP`;
  return `${normalized}-USDT`;
}
