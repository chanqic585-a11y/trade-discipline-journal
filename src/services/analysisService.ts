import { createTradeAnalysis } from '../db/repositories';
import { Trade, TradeAnalysis } from '../types';

export type TradeAnalysisDraft = Omit<TradeAnalysis, 'id' | 'createdAt'>;

export interface AnalysisProvider {
  generateTradeAnalysis(trade: Trade): TradeAnalysisDraft;
}

function symbolScore(symbol: string) {
  return symbol
    .split('')
    .reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export const mockAnalysisProvider: AnalysisProvider = {
  generateTradeAnalysis(trade) {
    const score = symbolScore(trade.symbol);
    const atr = round(trade.entryPrice * (0.008 + (score % 7) / 1000));
    const rsi = round(45 + (score % 24));
    const support = round(Math.max(0, trade.entryPrice - atr * 1.4));
    const resistance = round(trade.entryPrice + atr * 1.6);
    const hasStopLoss = trade.stopLossPrice > 0;
    const hasTakeProfit = trade.takeProfitPrice !== null && trade.takeProfitPrice > 0;
    const riskWarning = hasStopLoss
      ? 'Risk is defined by the saved stop loss. This is not a trading recommendation.'
      : 'Risk calculation requires stop loss / take profit.';

    return {
      tradeId: trade.id,
      trend: trade.direction === 'long' ? 'Current structure: upward-biased snapshot' : 'Current structure: downward-biased snapshot',
      volumeState: trade.leverage >= 4 ? 'Volatility participation: elevated' : 'Volume state: neutral placeholder',
      rsi,
      atr,
      setupType: hasStopLoss && hasTakeProfit ? 'Risk-defined quick trade' : 'Quick trade snapshot',
      confidence: 55 + (score % 26),
      support,
      resistance,
      riskWarning,
      marketSummary:
        'Mock analysis generated from saved trade inputs only. It describes the recorded market context and does not predict future price or recommend buying or selling.',
      isMock: true,
    };
  },
};

export async function generateAndSaveMockAnalysis(trade: Trade, provider: AnalysisProvider = mockAnalysisProvider) {
  return createTradeAnalysis(provider.generateTradeAnalysis(trade));
}
