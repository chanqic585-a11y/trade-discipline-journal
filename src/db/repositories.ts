import { getDatabase } from './database';
import {
  AccountSettings,
  AlertLog,
  AlertType,
  CreateTradeInput,
  ReviewTradeInput,
  Trade,
} from '../types';

type TradeRow = Omit<
  Trade,
  | 'isFollowingSystem'
  | 'followedPlan'
  | 'movedStopLoss'
  | 'addedPosition'
  | 'earlyTakeProfit'
  | 'impulsiveTrade'
> & {
  isFollowingSystem: number;
  followedPlan: number | null;
  movedStopLoss: number | null;
  addedPosition: number | null;
  earlyTakeProfit: number | null;
  impulsiveTrade: number | null;
};

type AccountRow = Omit<AccountSettings, 'preTradeCheckEnabled'> & {
  preTradeCheckEnabled: number;
};

function toBoolean(value: number | null): boolean | null {
  if (value === null) return null;
  return value === 1;
}

function mapTrade(row: TradeRow): Trade {
  return {
    ...row,
    isFollowingSystem: row.isFollowingSystem === 1,
    followedPlan: toBoolean(row.followedPlan),
    movedStopLoss: toBoolean(row.movedStopLoss),
    addedPosition: toBoolean(row.addedPosition),
    earlyTakeProfit: toBoolean(row.earlyTakeProfit),
    impulsiveTrade: toBoolean(row.impulsiveTrade),
  };
}

function mapAccount(row: AccountRow): AccountSettings {
  return {
    ...row,
    preTradeCheckEnabled: row.preTradeCheckEnabled === 1,
  };
}

export async function getAccountSettings(): Promise<AccountSettings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM AccountSettings WHERE id = 1');
  if (!row) throw new Error('Account settings are missing.');
  return mapAccount(row);
}

export async function updateAccountSettings(
  input: Pick<
    AccountSettings,
    | 'currentBalance'
    | 'maxRiskPerTradePercent'
    | 'maxDailyLossPercent'
    | 'maxConsecutiveLosses'
    | 'reviewReminderTime'
    | 'preTradeCheckEnabled'
  >,
) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE AccountSettings
      SET currentBalance = ?,
          maxRiskPerTradePercent = ?,
          maxDailyLossPercent = ?,
          maxConsecutiveLosses = ?,
          reviewReminderTime = ?,
          preTradeCheckEnabled = ?,
          updatedAt = ?
      WHERE id = 1`,
    [
      input.currentBalance,
      input.maxRiskPerTradePercent,
      input.maxDailyLossPercent,
      input.maxConsecutiveLosses,
      input.reviewReminderTime,
      input.preTradeCheckEnabled ? 1 : 0,
      new Date().toISOString(),
    ],
  );
}

export async function createTrade(input: CreateTradeInput): Promise<number> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO Trades (
      symbol, marketType, leverage, direction, entryPrice, stopLossPrice, takeProfitPrice,
      positionSize, setupType, entryReason, emotionBefore, isFollowingSystem, screenshotNote,
      status, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?)`,
    [
      input.symbol.trim().toUpperCase(),
      input.marketType,
      input.leverage,
      input.direction,
      input.entryPrice,
      input.stopLossPrice,
      input.takeProfitPrice,
      input.positionSize,
      input.setupType,
      input.entryReason.trim(),
      input.emotionBefore,
      input.isFollowingSystem ? 1 : 0,
      input.screenshotNote.trim(),
      now,
    ],
  );
  return result.lastInsertRowId;
}

export async function reviewTrade(input: ReviewTradeInput) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE Trades
      SET status = 'reviewed',
          exitPrice = ?,
          pnl = ?,
          followedPlan = ?,
          movedStopLoss = ?,
          addedPosition = ?,
          earlyTakeProfit = ?,
          impulsiveTrade = ?,
          lossType = ?,
          reviewNote = ?,
          nextImprovement = ?,
          closedAt = ?,
          reviewedAt = ?
      WHERE id = ?`,
    [
      input.exitPrice,
      input.pnl,
      input.followedPlan ? 1 : 0,
      input.movedStopLoss ? 1 : 0,
      input.addedPosition ? 1 : 0,
      input.earlyTakeProfit ? 1 : 0,
      input.impulsiveTrade ? 1 : 0,
      input.lossType,
      input.reviewNote.trim(),
      input.nextImprovement.trim(),
      now,
      now,
      input.tradeId,
    ],
  );

  await db.runAsync(
    `UPDATE AccountSettings
      SET currentBalance = currentBalance + ?,
          updatedAt = ?
      WHERE id = 1`,
    [input.pnl, now],
  );
}

export async function listTrades(): Promise<Trade[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TradeRow>('SELECT * FROM Trades ORDER BY createdAt DESC');
  return rows.map(mapTrade);
}

export async function listUnreviewedTrades(): Promise<Trade[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TradeRow>(
    `SELECT * FROM Trades WHERE status = 'planned' ORDER BY createdAt ASC`,
  );
  return rows.map(mapTrade);
}

export async function getLatestTrade(): Promise<Trade | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TradeRow>('SELECT * FROM Trades ORDER BY createdAt DESC LIMIT 1');
  return row ? mapTrade(row) : null;
}

export async function listTradesBetween(startIso: string, endIso: string): Promise<Trade[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TradeRow>(
    `SELECT * FROM Trades
      WHERE createdAt >= ? AND createdAt < ?
      ORDER BY createdAt ASC`,
    [startIso, endIso],
  );
  return rows.map(mapTrade);
}

export async function createAlertLog(input: Omit<AlertLog, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO AlertLogs (
      tradeId, symbol, alertType, triggerPrice, currentPrice, message, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.tradeId,
      input.symbol,
      input.alertType,
      input.triggerPrice,
      input.currentPrice,
      input.message,
      new Date().toISOString(),
    ],
  );
  return result.lastInsertRowId;
}

export async function hasAlertLog(tradeId: number, alertType: AlertType): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM AlertLogs WHERE tradeId = ? AND alertType = ?',
    [tradeId, alertType],
  );
  return (row?.count ?? 0) > 0;
}

export async function listAlertLogs(limit = 20): Promise<AlertLog[]> {
  const db = await getDatabase();
  return db.getAllAsync<AlertLog>(
    `SELECT * FROM AlertLogs
      ORDER BY createdAt DESC
      LIMIT ?`,
    [limit],
  );
}
