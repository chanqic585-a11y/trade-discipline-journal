# Trade Discipline Journal

React Native + Expo app for crypto trade planning, review, discipline rules, local statistics, the V2 AI Trading Copilot foundation, the V3 Feature Database, the V4 Backend + CCXT Market Service, and the V5 Python Feature Engine.

This app is not investment advice. It only connects to public market data for alerts and research context, does not use trading permissions, does not provide buy/sell signals, and does not place orders.

## V4 Backend + CCXT Market Service

V4 adds a Python FastAPI backend that reads OKX public market data through CCXT. The backend is optional at runtime: the app tries the backend first, then keeps the existing local, mock, and OKX foreground WebSocket fallback behavior when the backend is unavailable.

Implemented in this version:

- `api/` FastAPI service.
- CCXT public OKX market adapter.
- `GET /health`.
- `GET /market/ticker?exchange=okx&symbol=BTC/USDT`.
- `GET /market/ohlcv?exchange=okx&symbol=BTC/USDT&timeframe=1m&limit=200`.
- `GET /market/features?exchange=okx&symbol=BTC/USDT`.
- App-side backend market client with timeout and safe fallback.
- Quick Trade entry snapshots can use V4 backend public ticker price when available.
- Monitor can preload backend public ticker prices before OKX foreground WebSocket updates.

V4 safety boundaries:

- Public market data only.
- No Trade API.
- No Withdraw API.
- No API Key storage.
- No automatic trading.
- No order placement.
- No buy/sell advice.
- No future price prediction.

### Run the V4 backend

Create and activate a local Python environment, then install the backend dependencies:

```powershell
cd D:\Codex-Workspace\trade-discipline-journal
python -m venv .venv-api
.venv-api\Scripts\python.exe -m pip install -r api\requirements.txt
```

Start the backend:

```powershell
.venv-api\Scripts\python.exe -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

Check the backend:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/health
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8000/market/ticker?exchange=okx&symbol=BTC%2FUSDT"
```

For Expo Go on a physical Android phone, the app tries to infer your computer's Metro host and call the same host on port `8000`. Keep the phone and computer on the same network. If the backend is unreachable, the app remains usable and falls back to local data, mock analysis, and OKX foreground WebSocket monitoring.

## V5 Python Feature Engine

V5 adds a Python Feature Engine to the FastAPI backend. It converts OKX public OHLCV and ticker data into structured research features that the app can upsert into the local SQLite `TradeFeatures` table.

Implemented in this version:

- `api/feature_engine.py` for pure-Python indicator calculation.
- `GET /features/market?exchange=okx&symbol=BTC/USDT&timeframe=1h&limit=200`.
- `GET /features/trade-context?exchange=okx&symbol=BTC/USDT&direction=long&entryPrice=100000&timeframe=1h&limit=200`.
- EMA, MACD, RSI, ATR, volatility, trend direction, data quality, and missing-field output.
- App-side `featureApiService.ts`.
- Data Quality page action: `Refresh From Backend`.
- Backend feature rows are written to local SQLite through the existing `TradeFeatures` upsert path.
- If the backend is unavailable, the app keeps the V3 local feature generation fallback.

V5 safety boundaries:

- Public market data only.
- No real AI integration.
- No signal engine.
- No buy/sell advice.
- No Trade API.
- No Withdraw API.
- No API Key storage.
- No account balance or position reads.
- No automatic trading.
- No order placement or cancellation.

Run the backend as described in the V4 section, then test V5:

```powershell
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8000/features/market?exchange=okx&symbol=BTC%2FUSDT&timeframe=1h&limit=200"
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8000/features/trade-context?exchange=okx&symbol=BTC%2FUSDT&direction=long&entryPrice=100000&timeframe=1h&limit=200"
```

## V2 AI Trading Copilot Foundation

V2 moves the app from a pure trading journal toward an AI Trading Copilot foundation while keeping the V1.1 safety boundaries.

Implemented in this version:

- Quick Trade for 10-second trade capture.
- Trade Detail with Overview, Mock AI Analysis, Snapshot, Risk, Timeline, and Review status.
- Local `TradeAnalysis`, `TradeSnapshots`, and `TradeTimeline` tables.
- Service-layer flow for Quick Trade, mock analysis, snapshots, and lifecycle events.
- Dashboard Copilot cards for Open Trades, Today's Risk, AI Watch, Recent Timeline, Closest Stop Loss, and Closest Take Profit.
- Trade lifecycle status supports `planned`, `open`, `watching`, `closed`, and `reviewed`.

Important boundaries:

- AI Analysis is currently Mock Analysis only.
- No real AI API is connected.
- No Feature Engine, Python backend, CCXT, machine learning, or signal engine is included in V2.
- No Trade API key or Withdraw API key is stored.
- The app does not place orders and does not automate trading.
- Mock Analysis describes saved trade context only. It does not recommend buying or selling and does not predict future price.

## V3 Feature Database

V3 adds a local Feature Database that converts each trade into a structured row for future analysis, AI memory, RAG, reports, and model training.

Implemented in this version:

- Local `TradeFeatures` SQLite table.
- `src/feature-engine/featureEngine.ts` for deterministic local feature generation.
- `src/feature-engine/csvExport.ts` for CSV text export.
- Data Quality page under `我的 -> Feature Database`.
- Feature generation from `Trades`, latest `TradeSnapshots`, and latest `TradeAnalysis`.
- Missing market data is stored as `null`, not guessed.

V3 does not include:

- Python backend.
- CCXT.
- Real AI API.
- Exchange Trade API permissions.
- Withdraw API permissions.
- Automatic trading or order placement.

### TradeFeatures Fields

`TradeFeatures` stores:

- Identity: `tradeId`, `featureVersion`, `source`
- Trade context: `symbol`, `marketType`, `direction`, `tradeStatus`
- Timing: `entryTime`, `exitTime`
- Prices and size: `entryPrice`, `exitPrice`, `currentPrice`, `positionSize`, `leverage`
- Market features: `volume`, `ema`, `macd`, `rsi`, `atr`, `openInterest`, `funding`, `fearGreed`, `change24h`
- Listing and volatility: `listingTime`, `hoursSinceListing`, `marketVolatility`
- Pattern context: `candlePattern`, `trend`, `support`, `resistance`, `setupType`, `setupConfidence`
- Result labels: `finalPnl`, `isDisciplineLoss`, `followedPlan`, `emotionBefore`, `isFollowingSystem`
- Quality metadata: `dataQualityScore`, `missingFieldsJson`, `generatedAt`, `createdAt`, `updatedAt`

Fields that are not available in the current local app, such as real volume, EMA, MACD, Open Interest, Funding, Fear & Greed, and listing time, are intentionally stored as `null`.

### CSV Export

The Data Quality page can export all local `TradeFeatures` rows as CSV through the device share sheet. The export is generated locally from SQLite data. It is not uploaded to a server.

## Features

- Dashboard with discipline-first status.
- Initial Setup for local starting capital. Suggested default: 15000.
- Dashboard with discipline score.
- Quick Trade with minimal fields: symbol, direction, entry price, position size, leverage, optional stop loss, and optional take profit.
- Trade Detail with generated Mock Analysis, Snapshot, Risk Card, and Timeline.
- Trade Plan form with stop-loss, leverage, emotion, Pre-Trade Checklist, and risk checks.
- Review Trade flow for unreviewed planned trades.
- Trade History with filters: all, win, loss, discipline loss, unreviewed.
- Statistics: win rate, total PnL, average win/loss, profit-loss ratio, max consecutive losses, discipline execution, setup extremes.
- Rules & Reminders for local risk settings and local review notification.
- OKX public market monitor for planned trades while the app is open in the foreground.
- Optional V4 FastAPI backend for OKX public ticker, OHLCV, and market features.
- Optional V5 Python Feature Engine for public-market feature enrichment.
- Four bottom tabs: 首页, 计划, 复盘, 我的. Monitor, Statistics, Rules, and History live under 我的.
- SQLite local storage. No login and no cloud sync.

## Quick Trade Data Flow

Quick Trade saves the trade and creates the V2 Copilot data records in this order:

1. `createTrade()`
2. `createEntrySnapshot()`
3. `generateAndSaveMockAnalysis()`
4. `createTimelineEvent("Trade Created")`
5. `createTimelineEvent("Snapshot Saved")`
6. `createTimelineEvent("Analysis Generated")`
7. `calculateTradeRiskMetrics()`
8. `createTimelineEvent("Risk Calculated")`
9. Navigate to Trade Detail

Quick Trade does not require long notes, manual setup labels, emotion fields, or the V1.1 Pre-Trade Checklist. The full V1.1 trade plan remains available from the Plan tab for slower planned trades.

## OKX Price Alerts

The Monitor tab tries the V4 backend public ticker first, then listens to OKX public WebSocket market data for unreviewed planned trades while the app is open in the foreground.

Safety boundaries:

- Uses only public market data from the V4 backend and OKX public WebSocket: `wss://ws.okx.com:8443/ws/v5/public`.
- Does not ask for, store, or use Trade API keys.
- Does not ask for, store, or use Withdraw API keys.
- Does not place orders or connect to trading permissions.
- Does not provide buy/sell recommendations.
- Alerts are reminders only; they are not guaranteed execution instructions.

Instrument mapping in the MVP:

- Spot plans use `SYMBOL-USDT`, for example `BTC` becomes `BTC-USDT`.
- Futures plans use `SYMBOL-USDT-SWAP`, for example `BTC` becomes `BTC-USDT-SWAP`.
- If the symbol already contains `-`, the app uses it as the OKX instrument id.
- Spot plans are fixed to 1x and long-only in this MVP.
- Futures plans support long/short direction and 1-5x leverage.

Trigger rules:

```text
Long:
currentPrice <= stopLossPrice   -> stop-loss alert
currentPrice >= takeProfitPrice -> take-profit alert

Short:
currentPrice >= stopLossPrice   -> stop-loss alert
currentPrice <= takeProfitPrice -> take-profit alert
```

When a trigger fires, the app writes an `AlertLogs` row, shows an in-app alert, and sends a local notification with sound. If the WebSocket disconnects while the app is running, it retries automatically.

MVP limitation: this is a foreground monitor. If Android kills the app or the phone blocks background activity, the WebSocket listener can stop. A later version can use an Android foreground service or a server-side monitor if background reliability becomes the priority.

## Pre-Trade Checklist

Before saving a trade plan, every checklist item must be confirmed:

- 我不是为了回本开单
- 我不是因为害怕错过
- 我已经设置止损
- 本单风险不超过账户 2%
- 这笔交易符合我的形态系统
- 我已准备好接受止损

The checklist does not replace numeric risk checks. The app still blocks plans that exceed the configured max risk per trade.

## Discipline Score

The dashboard shows a 0-100 discipline score. The score starts at 100 and deducts points for issues such as:

- Unreviewed planned trades.
- Daily loss beyond the configured risk line.
- Consecutive losses reaching the stop-trading rule.
- Missing stop-loss on the latest trade.
- Plans that do not follow the system.
- Moved stop-loss, impulsive trades, or discipline losses.

## Run

```bash
npm install
npm run start
```

Then scan the Expo QR code with Expo Go.

Important: `http://localhost:8081` is the Expo/Metro bundler endpoint, not a normal web page. If you open it in a browser, you may see JSON or bundled text that looks like乱码. That is expected. Use Expo Go on your phone and scan the QR code shown in the terminal.

Current same-Wi-Fi Expo Go URL on this machine is usually:

```text
exp://172.20.14.53:8081
```

If your network IP changes, run `npm run start` again and use the QR code from the terminal.

If this machine has no global Node/npm in PATH, use an installed Node.js runtime or run with the bundled Codex runtime:

```powershell
$env:PATH='C:\Users\阿俊\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
& 'C:\Users\阿俊\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' install
& 'C:\Users\阿俊\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' start
```

On this Codex workspace, you can also run:

```powershell
.\Start-Trade-Discipline-Journal.cmd
```

The helper script starts Expo on port `8082` so it does not collide with another running Metro server.

## Build Android APK

For Android, the simpler installable-app path is an Expo EAS cloud build. This avoids installing Android Studio and Android SDK locally.

Run:

```powershell
.\Build-Android-APK.cmd
```

Double-clicking `Build-Android-APK.cmd` opens a PowerShell window and writes build output to:

```text
build-android-apk.log
```

If nothing seems to happen, open that log file in the project folder.

The script uses the local `eas-cli` installed in project `node_modules`. This avoids `pnpm dlx` module loading errors from Windows user paths with non-ASCII characters.

The script also runs TypeScript directly with the bundled `node.exe`, so it is not blocked by pnpm's optional build-script approval prompt.

The script sets `EAS_NO_VCS=1`, so EAS can build even when local Git is not installed or not available in PATH.

If EAS password login fails but Expo website login works, use an Expo Access Token:

1. Log in at `https://expo.dev/login`.
2. Open account settings and create an Access Token.
3. Double-click `Build-Android-APK.cmd`.
4. Paste the token when prompted. The input is hidden in the terminal.

The token is saved locally to `.env.local`, which is ignored by git. Do not share this token or send screenshots of it.

If a token is ever shown in a screenshot or terminal output, revoke it in Expo immediately and create a new one.

If EAS fails in `Install dependencies` with `packages field missing or empty`, check `pnpm-workspace.yaml`. This single-project app needs:

```yaml
packages:
  - "."
```

The script uses:

```bash
eas build -p android --profile preview
```

The `preview` profile in `eas.json` is configured to generate an `.apk`, which can be installed directly on an Android phone. You may need to log in to an Expo account in the terminal the first time.

Notes:

- APK builds are for direct Android installation and testing.
- Google Play publishing normally uses an `.aab`, which is configured under the `production` profile.
- This project is currently offline/local-first and does not require a server for the MVP.

## Open Source References Checked

Relevant public trading journal projects are mostly web or desktop apps rather than React Native mobile apps. The useful product patterns for this MVP are:

- Privacy and data ownership: keep the first version local-first and simple.
- Manual journal workflow: plan before trade, review after trade.
- Clear statistics: win rate, average win/loss, profit/loss ratio, discipline-loss tracking.
- Avoid scope creep: no exchange API, no charting, no automatic trade import in MVP.

Examples reviewed:

- TradeNote: open source trading journal focused on simplicity, privacy, and data ownership.
- Deltalytix: modern trading journal using Next.js, Supabase, Prisma, Tailwind, and analytics.
- TradingBook: Electron + React trading journal with local ownership focus.
- Other trading journal repos confirm common metrics like total trades, win rate, average win/loss, drawdown, and risk-reward ratio.

## Type Check

```bash
npm run typecheck
```

Codex verification used:

```powershell
$env:PATH='C:\Users\阿俊\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
& 'C:\Users\阿俊\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' run typecheck
& 'C:\Users\阿俊\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' exec expo config --type public
```

## Risk Rules

Single-trade max loss:

```text
abs(entryPrice - stopLossPrice) / entryPrice * positionSize * leverage
```

Default limits:

- Max risk per trade: 2% of current balance.
- Max daily loss: 3% of current balance.
- Stop creating new plans after 2 consecutive losses.
- New plans are blocked when unreviewed trades exist.
- Spot leverage is fixed to 1x.
- Futures leverage must be 1 to 5.
- Stop-loss price is required in the full V1.1 plan flow.
- Quick Trade allows missing stop loss so the trade can be captured quickly, but the Risk Card will show `Risk calculation requires stop loss / take profit.`
- Pre-Trade Checklist must be fully checked before saving a full V1.1 plan.

## Project Structure

```text
App.tsx
api/
  feature_engine.py Python Feature Engine for public market features
  main.py          FastAPI public market API
  market_service.py
  requirements.txt
src/
  components/      Shared form and layout components
  constants.ts     Labels and enum options
  db/              SQLite initialization and CRUD
  feature-engine/  Local Feature Database generation and CSV export
  screens/         MVP screens
  services/        Risk, statistics, date, notification, OKX monitor, V2 Copilot data flow
  theme/           Colors and spacing
  types.ts         App TypeScript models
```

## Data Tables

- `AccountSettings`
- `Trades`
- `AlertLogs`
- `TradeAnalysis`
- `TradeSnapshots`
- `TradeTimeline`
- `TradeFeatures`

The database is created locally by `expo-sqlite` on first app launch. V2 and V3 add new tables through non-destructive migrations with `CREATE TABLE IF NOT EXISTS`; old `Trades`, `AccountSettings`, and `AlertLogs` data is not deleted or rebuilt.
