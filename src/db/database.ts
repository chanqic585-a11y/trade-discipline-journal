import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('trade_discipline_journal.db');
  }
  return dbPromise;
}

export async function initDatabase() {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS AccountSettings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      initialBalance REAL NOT NULL,
      currentBalance REAL NOT NULL,
      maxRiskPerTradePercent REAL NOT NULL,
      maxDailyLossPercent REAL NOT NULL,
      maxConsecutiveLosses INTEGER NOT NULL,
      reviewReminderTime TEXT NOT NULL,
      preTradeCheckEnabled INTEGER NOT NULL DEFAULT 1,
      setupCompleted INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      marketType TEXT NOT NULL,
      leverage INTEGER NOT NULL,
      direction TEXT NOT NULL,
      entryPrice REAL NOT NULL,
      stopLossPrice REAL NOT NULL,
      takeProfitPrice REAL,
      positionSize REAL NOT NULL,
      setupType TEXT NOT NULL,
      entryReason TEXT NOT NULL,
      emotionBefore TEXT NOT NULL,
      isFollowingSystem INTEGER NOT NULL,
      screenshotNote TEXT NOT NULL,
      status TEXT NOT NULL,
      exitPrice REAL,
      pnl REAL,
      followedPlan INTEGER,
      movedStopLoss INTEGER,
      addedPosition INTEGER,
      earlyTakeProfit INTEGER,
      impulsiveTrade INTEGER,
      lossType TEXT,
      reviewNote TEXT,
      nextImprovement TEXT,
      createdAt TEXT NOT NULL,
      closedAt TEXT,
      reviewedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS AlertLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tradeId INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      alertType TEXT NOT NULL,
      triggerPrice REAL NOT NULL,
      currentPrice REAL NOT NULL,
      message TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (tradeId) REFERENCES Trades(id)
    );

    CREATE INDEX IF NOT EXISTS idx_trades_createdAt ON Trades(createdAt);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON Trades(status);
    CREATE INDEX IF NOT EXISTS idx_alert_logs_trade_type ON AlertLogs(tradeId, alertType);
    CREATE INDEX IF NOT EXISTS idx_alert_logs_createdAt ON AlertLogs(createdAt);
  `);

  const accountColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(AccountSettings)');
  if (!accountColumns.some((column) => column.name === 'preTradeCheckEnabled')) {
    await db.execAsync('ALTER TABLE AccountSettings ADD COLUMN preTradeCheckEnabled INTEGER NOT NULL DEFAULT 1;');
  }
  if (!accountColumns.some((column) => column.name === 'setupCompleted')) {
    await db.execAsync('ALTER TABLE AccountSettings ADD COLUMN setupCompleted INTEGER NOT NULL DEFAULT 0;');
  }

  await db.execAsync('PRAGMA user_version = 1;');
}
