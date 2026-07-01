import { createTradeSnapshot } from '../db/repositories';
import { Trade } from '../types';

export async function createEntrySnapshot(trade: Trade, currentPrice = trade.entryPrice) {
  return createTradeSnapshot({
    tradeId: trade.id,
    symbol: trade.symbol,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    currentPrice,
    positionSize: trade.positionSize,
    leverage: trade.leverage,
    snapshotType: 'entry',
  });
}
