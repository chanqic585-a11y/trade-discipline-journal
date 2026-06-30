# Trade Discipline Journal

React Native + Expo MVP for crypto trade planning, review, discipline rules, and local statistics.

This app is not investment advice. It only connects to OKX public market data for alerts, does not use trading permissions, does not provide buy/sell signals, and does not place orders.

## Features

- Dashboard with discipline-first status.
- Trade Plan form with stop-loss, leverage, emotion, and risk checks.
- Review Trade flow for unreviewed planned trades.
- Trade History with filters: all, win, loss, discipline loss, unreviewed.
- Statistics: win rate, total PnL, average win/loss, profit-loss ratio, max consecutive losses, discipline execution, setup extremes.
- Rules & Reminders for local risk settings and local review notification.
- OKX public market monitor for planned trades while the app is open in the foreground.
- SQLite local storage. No login and no cloud sync.

## OKX Price Alerts

The Monitor tab listens to OKX public WebSocket market data for unreviewed planned trades while the app is open in the foreground.

Safety boundaries:

- Uses only OKX public market WebSocket: `wss://ws.okx.com:8443/ws/v5/public`.
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
- Futures plans support long/short direction and 1-10x leverage.

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
- Futures leverage must be 1 to 10.
- Stop-loss price is required.

## Project Structure

```text
App.tsx
src/
  components/      Shared form and layout components
  constants.ts     Labels and enum options
  db/              SQLite initialization and CRUD
  screens/         MVP screens
  services/        Risk, statistics, date, notification, OKX monitor logic
  theme/           Colors and spacing
  types.ts         App TypeScript models
```

## Data Tables

- `AccountSettings`
- `Trades`
- `AlertLogs`

The database is created locally by `expo-sqlite` on first app launch.
