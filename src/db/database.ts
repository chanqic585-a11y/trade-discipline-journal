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

    CREATE TABLE IF NOT EXISTS TradeAnalysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tradeId INTEGER NOT NULL,
      trend TEXT NOT NULL,
      volumeState TEXT NOT NULL,
      rsi REAL NOT NULL,
      atr REAL NOT NULL,
      setupType TEXT NOT NULL,
      confidence REAL NOT NULL,
      support REAL NOT NULL,
      resistance REAL NOT NULL,
      riskWarning TEXT NOT NULL,
      marketSummary TEXT NOT NULL,
      isMock INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (tradeId) REFERENCES Trades(id)
    );

    CREATE TABLE IF NOT EXISTS TradeSnapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tradeId INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      entryPrice REAL NOT NULL,
      currentPrice REAL NOT NULL,
      positionSize REAL NOT NULL,
      leverage INTEGER NOT NULL,
      snapshotType TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (tradeId) REFERENCES Trades(id)
    );

    CREATE TABLE IF NOT EXISTS TradeTimeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tradeId INTEGER NOT NULL,
      eventType TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      metadataJson TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (tradeId) REFERENCES Trades(id)
    );

    CREATE TABLE IF NOT EXISTS TradeFeatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tradeId INTEGER NOT NULL UNIQUE,
      featureVersion TEXT NOT NULL,
      source TEXT NOT NULL,
      symbol TEXT NOT NULL,
      marketType TEXT NOT NULL,
      direction TEXT NOT NULL,
      tradeStatus TEXT NOT NULL,
      entryTime TEXT NOT NULL,
      exitTime TEXT,
      entryPrice REAL NOT NULL,
      exitPrice REAL,
      currentPrice REAL,
      positionSize REAL NOT NULL,
      leverage INTEGER NOT NULL,
      volume REAL,
      ema REAL,
      macd REAL,
      rsi REAL,
      atr REAL,
      openInterest REAL,
      funding REAL,
      fearGreed REAL,
      change24h REAL,
      listingTime TEXT,
      hoursSinceListing REAL,
      marketVolatility REAL,
      candlePattern TEXT,
      trend TEXT,
      support REAL,
      resistance REAL,
      setupType TEXT,
      setupConfidence REAL,
      finalPnl REAL,
      isDisciplineLoss INTEGER,
      followedPlan INTEGER,
      emotionBefore TEXT,
      isFollowingSystem INTEGER,
      dataQualityScore REAL NOT NULL,
      missingFieldsJson TEXT NOT NULL,
      generatedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (tradeId) REFERENCES Trades(id)
    );

    CREATE TABLE IF NOT EXISTS SkillResults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skillId TEXT NOT NULL,
      skillName TEXT NOT NULL,
      skillVersion TEXT NOT NULL,
      runGroupId TEXT,
      tradeId INTEGER,
      symbol TEXT,
      category TEXT NOT NULL,
      score REAL,
      label TEXT,
      summary TEXT NOT NULL,
      explanation TEXT NOT NULL,
      evidenceJson TEXT NOT NULL,
      outputJson TEXT NOT NULL,
      source TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (tradeId) REFERENCES Trades(id)
    );

    CREATE INDEX IF NOT EXISTS idx_trades_createdAt ON Trades(createdAt);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON Trades(status);
    CREATE INDEX IF NOT EXISTS idx_alert_logs_trade_type ON AlertLogs(tradeId, alertType);
    CREATE INDEX IF NOT EXISTS idx_alert_logs_createdAt ON AlertLogs(createdAt);
    CREATE INDEX IF NOT EXISTS idx_trade_analysis_trade ON TradeAnalysis(tradeId);
    CREATE INDEX IF NOT EXISTS idx_trade_snapshots_trade_created ON TradeSnapshots(tradeId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_trade_timeline_trade_created ON TradeTimeline(tradeId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_trade_timeline_created ON TradeTimeline(createdAt);
    CREATE INDEX IF NOT EXISTS idx_trade_features_trade ON TradeFeatures(tradeId);
    CREATE INDEX IF NOT EXISTS idx_trade_features_symbol ON TradeFeatures(symbol);
    CREATE INDEX IF NOT EXISTS idx_trade_features_setup ON TradeFeatures(setupType);
    CREATE INDEX IF NOT EXISTS idx_trade_features_quality ON TradeFeatures(dataQualityScore);
    CREATE INDEX IF NOT EXISTS idx_skill_results_skill ON SkillResults(skillId);
    CREATE INDEX IF NOT EXISTS idx_skill_results_trade ON SkillResults(tradeId);
    CREATE INDEX IF NOT EXISTS idx_skill_results_symbol ON SkillResults(symbol);
    CREATE INDEX IF NOT EXISTS idx_skill_results_created ON SkillResults(createdAt);
    CREATE INDEX IF NOT EXISTS idx_skill_results_run_group ON SkillResults(runGroupId);
  `);

  const accountColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(AccountSettings)');
  if (!accountColumns.some((column) => column.name === 'preTradeCheckEnabled')) {
    await db.execAsync('ALTER TABLE AccountSettings ADD COLUMN preTradeCheckEnabled INTEGER NOT NULL DEFAULT 1;');
  }
  if (!accountColumns.some((column) => column.name === 'setupCompleted')) {
    await db.execAsync('ALTER TABLE AccountSettings ADD COLUMN setupCompleted INTEGER NOT NULL DEFAULT 0;');
  }

  const skillResultColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(SkillResults)');
  if (!skillResultColumns.some((column) => column.name === 'runGroupId')) {
    await db.execAsync('ALTER TABLE SkillResults ADD COLUMN runGroupId TEXT;');
  }

  await db.execAsync('PRAGMA user_version = 5;');
}
