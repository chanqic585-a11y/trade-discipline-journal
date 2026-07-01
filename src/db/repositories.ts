import { getDatabase } from './database';
import {
  AccountSettings,
  AlertLog,
  AlertType,
  DataQualitySummary,
  CreateTradeInput,
  ReviewTradeInput,
  Trade,
  TradeAnalysis,
  TradeFeature,
  TradeSnapshot,
  TradeStatus,
  TradeTimelineEvent,
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

type AccountRow = Omit<AccountSettings, 'preTradeCheckEnabled' | 'setupCompleted'> & {
  preTradeCheckEnabled: number;
  setupCompleted: number;
};

type TradeAnalysisRow = Omit<TradeAnalysis, 'isMock'> & {
  isMock: number;
};

type TradeFeatureRow = Omit<TradeFeature, 'isDisciplineLoss' | 'followedPlan' | 'isFollowingSystem'> & {
  isDisciplineLoss: number | null;
  followedPlan: number | null;
  isFollowingSystem: number | null;
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
    setupCompleted: row.setupCompleted === 1,
  };
}

function mapTradeAnalysis(row: TradeAnalysisRow): TradeAnalysis {
  return {
    ...row,
    isMock: row.isMock === 1,
  };
}

function mapTradeFeature(row: TradeFeatureRow): TradeFeature {
  return {
    ...row,
    isDisciplineLoss: toBoolean(row.isDisciplineLoss),
    followedPlan: toBoolean(row.followedPlan),
    isFollowingSystem: toBoolean(row.isFollowingSystem),
  };
}

export async function getAccountSettings(): Promise<AccountSettings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM AccountSettings WHERE id = 1');
  if (!row) throw new Error('Account settings are missing.');
  return mapAccount(row);
}

export async function hasAccountSettings(): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM AccountSettings WHERE id = 1 AND setupCompleted = 1',
  );
  return (row?.count ?? 0) > 0;
}

export async function createInitialAccountSettings(initialBalance: number) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO AccountSettings (
      id, initialBalance, currentBalance, maxRiskPerTradePercent, maxDailyLossPercent,
      maxConsecutiveLosses, reviewReminderTime, preTradeCheckEnabled, setupCompleted, createdAt, updatedAt
    ) VALUES (1, ?, ?, 2, 3, 2, '21:00', 1, 1, ?, ?)`,
    [initialBalance, initialBalance, now, now],
  );
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
          setupCompleted = 1,
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

export async function createTrade(input: CreateTradeInput, status: Exclude<TradeStatus, 'reviewed'> = 'planned'): Promise<number> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO Trades (
      symbol, marketType, leverage, direction, entryPrice, stopLossPrice, takeProfitPrice,
      positionSize, setupType, entryReason, emotionBefore, isFollowingSystem, screenshotNote,
      status, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      status,
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

  await db.runAsync(
    `INSERT INTO TradeTimeline (
      tradeId, eventType, title, description, metadataJson, createdAt
    ) VALUES (?, 'review_completed', 'Review Completed', 'Trade review was saved and account balance was updated.', ?, ?)`,
    [input.tradeId, JSON.stringify({ pnl: input.pnl, lossType: input.lossType }), now],
  );
}

export async function getTradeById(tradeId: number): Promise<Trade | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TradeRow>('SELECT * FROM Trades WHERE id = ?', [tradeId]);
  return row ? mapTrade(row) : null;
}

export async function listTrades(): Promise<Trade[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TradeRow>('SELECT * FROM Trades ORDER BY createdAt DESC');
  return rows.map(mapTrade);
}

export async function listUnreviewedTrades(): Promise<Trade[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TradeRow>(
    `SELECT * FROM Trades
      WHERE status IN ('planned', 'open', 'watching', 'closed')
      ORDER BY createdAt ASC`,
  );
  return rows.map(mapTrade);
}

export async function listOpenTrades(): Promise<Trade[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TradeRow>(
    `SELECT * FROM Trades
      WHERE status IN ('planned', 'open', 'watching')
      ORDER BY createdAt DESC`,
  );
  return rows.map(mapTrade);
}

export async function listMonitorableTrades(): Promise<Trade[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TradeRow>(
    `SELECT * FROM Trades
      WHERE status IN ('planned', 'open', 'watching')
      ORDER BY createdAt ASC`,
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

export async function createTradeAnalysis(input: Omit<TradeAnalysis, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO TradeAnalysis (
      tradeId, trend, volumeState, rsi, atr, setupType, confidence, support,
      resistance, riskWarning, marketSummary, isMock, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.tradeId,
      input.trend,
      input.volumeState,
      input.rsi,
      input.atr,
      input.setupType,
      input.confidence,
      input.support,
      input.resistance,
      input.riskWarning,
      input.marketSummary,
      input.isMock ? 1 : 0,
      new Date().toISOString(),
    ],
  );
  return result.lastInsertRowId;
}

export async function getTradeAnalysisByTradeId(tradeId: number): Promise<TradeAnalysis | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TradeAnalysisRow>(
    `SELECT * FROM TradeAnalysis
      WHERE tradeId = ?
      ORDER BY createdAt DESC
      LIMIT 1`,
    [tradeId],
  );
  return row ? mapTradeAnalysis(row) : null;
}

export async function createTradeSnapshot(input: Omit<TradeSnapshot, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO TradeSnapshots (
      tradeId, symbol, direction, entryPrice, currentPrice, positionSize,
      leverage, snapshotType, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.tradeId,
      input.symbol,
      input.direction,
      input.entryPrice,
      input.currentPrice,
      input.positionSize,
      input.leverage,
      input.snapshotType,
      new Date().toISOString(),
    ],
  );
  return result.lastInsertRowId;
}

export async function listTradeSnapshots(tradeId: number): Promise<TradeSnapshot[]> {
  const db = await getDatabase();
  return db.getAllAsync<TradeSnapshot>(
    `SELECT * FROM TradeSnapshots
      WHERE tradeId = ?
      ORDER BY createdAt DESC`,
    [tradeId],
  );
}

export async function getLatestTradeSnapshot(tradeId: number): Promise<TradeSnapshot | null> {
  const db = await getDatabase();
  return db.getFirstAsync<TradeSnapshot>(
    `SELECT * FROM TradeSnapshots
      WHERE tradeId = ?
      ORDER BY createdAt DESC
      LIMIT 1`,
    [tradeId],
  );
}

export async function createTradeTimelineEvent(input: Omit<TradeTimelineEvent, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO TradeTimeline (
      tradeId, eventType, title, description, metadataJson, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.tradeId,
      input.eventType,
      input.title,
      input.description,
      input.metadataJson,
      new Date().toISOString(),
    ],
  );
  return result.lastInsertRowId;
}

export async function listTradeTimeline(tradeId: number): Promise<TradeTimelineEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<TradeTimelineEvent>(
    `SELECT * FROM TradeTimeline
      WHERE tradeId = ?
      ORDER BY createdAt ASC`,
    [tradeId],
  );
}

export async function listRecentTimeline(limit = 5): Promise<TradeTimelineEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<TradeTimelineEvent>(
    `SELECT * FROM TradeTimeline
      ORDER BY createdAt DESC
      LIMIT ?`,
    [limit],
  );
}

export async function upsertTradeFeature(input: Omit<TradeFeature, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO TradeFeatures (
      tradeId, featureVersion, source, symbol, marketType, direction, tradeStatus,
      entryTime, exitTime, entryPrice, exitPrice, currentPrice, positionSize, leverage,
      volume, ema, macd, rsi, atr, openInterest, funding, fearGreed, change24h,
      listingTime, hoursSinceListing, marketVolatility, candlePattern, trend, support,
      resistance, setupType, setupConfidence, finalPnl, isDisciplineLoss, followedPlan,
      emotionBefore, isFollowingSystem, dataQualityScore, missingFieldsJson, generatedAt,
      createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(tradeId) DO UPDATE SET
      featureVersion = excluded.featureVersion,
      source = excluded.source,
      symbol = excluded.symbol,
      marketType = excluded.marketType,
      direction = excluded.direction,
      tradeStatus = excluded.tradeStatus,
      entryTime = excluded.entryTime,
      exitTime = excluded.exitTime,
      entryPrice = excluded.entryPrice,
      exitPrice = excluded.exitPrice,
      currentPrice = excluded.currentPrice,
      positionSize = excluded.positionSize,
      leverage = excluded.leverage,
      volume = excluded.volume,
      ema = excluded.ema,
      macd = excluded.macd,
      rsi = excluded.rsi,
      atr = excluded.atr,
      openInterest = excluded.openInterest,
      funding = excluded.funding,
      fearGreed = excluded.fearGreed,
      change24h = excluded.change24h,
      listingTime = excluded.listingTime,
      hoursSinceListing = excluded.hoursSinceListing,
      marketVolatility = excluded.marketVolatility,
      candlePattern = excluded.candlePattern,
      trend = excluded.trend,
      support = excluded.support,
      resistance = excluded.resistance,
      setupType = excluded.setupType,
      setupConfidence = excluded.setupConfidence,
      finalPnl = excluded.finalPnl,
      isDisciplineLoss = excluded.isDisciplineLoss,
      followedPlan = excluded.followedPlan,
      emotionBefore = excluded.emotionBefore,
      isFollowingSystem = excluded.isFollowingSystem,
      dataQualityScore = excluded.dataQualityScore,
      missingFieldsJson = excluded.missingFieldsJson,
      generatedAt = excluded.generatedAt,
      updatedAt = excluded.updatedAt`,
    [
      input.tradeId,
      input.featureVersion,
      input.source,
      input.symbol,
      input.marketType,
      input.direction,
      input.tradeStatus,
      input.entryTime,
      input.exitTime,
      input.entryPrice,
      input.exitPrice,
      input.currentPrice,
      input.positionSize,
      input.leverage,
      input.volume,
      input.ema,
      input.macd,
      input.rsi,
      input.atr,
      input.openInterest,
      input.funding,
      input.fearGreed,
      input.change24h,
      input.listingTime,
      input.hoursSinceListing,
      input.marketVolatility,
      input.candlePattern,
      input.trend,
      input.support,
      input.resistance,
      input.setupType,
      input.setupConfidence,
      input.finalPnl,
      input.isDisciplineLoss === null ? null : input.isDisciplineLoss ? 1 : 0,
      input.followedPlan === null ? null : input.followedPlan ? 1 : 0,
      input.emotionBefore,
      input.isFollowingSystem === null ? null : input.isFollowingSystem ? 1 : 0,
      input.dataQualityScore,
      input.missingFieldsJson,
      input.generatedAt,
      now,
      now,
    ],
  );
  return result.lastInsertRowId;
}

export async function getTradeFeatureByTradeId(tradeId: number): Promise<TradeFeature | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TradeFeatureRow>('SELECT * FROM TradeFeatures WHERE tradeId = ?', [tradeId]);
  return row ? mapTradeFeature(row) : null;
}

export async function listTradeFeatures(): Promise<TradeFeature[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TradeFeatureRow>(
    `SELECT * FROM TradeFeatures
      ORDER BY entryTime DESC`,
  );
  return rows.map(mapTradeFeature);
}

export async function getDataQualitySummary(): Promise<DataQualitySummary> {
  const db = await getDatabase();
  const [tradeCount, featureCount, backendCount, qualityRow, latestRow] = await Promise.all([
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM Trades'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM TradeFeatures'),
    db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM TradeFeatures
        WHERE source = 'python_feature_engine_v5'`,
    ),
    db.getFirstAsync<{ averageQualityScore: number | null }>(
      'SELECT AVG(dataQualityScore) as averageQualityScore FROM TradeFeatures',
    ),
    db.getFirstAsync<{ latestGeneratedAt: string | null }>(
      'SELECT MAX(generatedAt) as latestGeneratedAt FROM TradeFeatures',
    ),
  ]);
  const features = await listTradeFeatures();
  const nullFieldCount = features.reduce((sum, feature) => {
    try {
      const missing = JSON.parse(feature.missingFieldsJson) as unknown;
      return sum + (Array.isArray(missing) ? missing.length : 0);
    } catch {
      return sum;
    }
  }, 0);
  const totalTrades = tradeCount?.count ?? 0;
  const featureRows = featureCount?.count ?? 0;

  return {
    totalTrades,
    featureRows,
    missingFeatureRows: Math.max(0, totalTrades - featureRows),
    averageQualityScore: qualityRow?.averageQualityScore ?? 0,
    backendEnrichedRows: backendCount?.count ?? 0,
    nullFieldCount,
    exportableRows: featureRows,
    latestGeneratedAt: latestRow?.latestGeneratedAt ?? null,
  };
}
