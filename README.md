# Oil Crack Quant Backtester

Demo web app for **3-2-1 crack spread** signals on WTI, augmented with a **US–Iran war-context overlay** (Hormuz risk, geopolitical risk premium, de-risk rules).

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/salmasaidane/oil-crack-backtest)

> **Important:** The deploy button only works **after** you **push code** to GitHub.  
> Verify first: https://github.com/salmasaidane/oil-crack-backtest/blob/main/app.json must open (not 404).  
> Empty repo → “No app.json” on Heroku. See **[REPO_SETUP.md](REPO_SETUP.md)**.

## Features

- **Data priority**: [EIA Open Data](https://www.eia.gov/opendata/) (with `EIA_API_KEY`) → [Stooq](https://stooq.com) WTI → seeded synthetic
- **EIA series**: WTI Cushing (`RWTC`), Gulf Coast gasoline (`RFGCUD`), heating oil (`NUSHHO`) — real 3-2-1 inputs in $/bbl and $/gal
- **War overlay**: GPR + Hormuz risk from Apr 2026 escalation window
- **Backtest**: Long/flat WTI, costs, Sharpe, drawdown, trade log
- **UI**: Parameter sliders, charts, trade log

## EIA API key (recommended)

1. Register free: https://www.eia.gov/opendata/register.php  
2. Local: copy `.env.example` → `.env` and set `EIA_API_KEY=your_key`  
3. Heroku: `heroku config:set EIA_API_KEY=your_key -a your-app-name`  
   Or enter it when using the Deploy button above.

Without a key, the app uses Stooq WTI + model-derived RBOB/HO.

## Local development

```bash
npm install
cp .env.example .env   # optional: add EIA_API_KEY
npm run dev
```

Open http://localhost:5173 (Vite proxies `/api` to port 3000).

Production-style:

```bash
npm run build
npm start
```

Open http://localhost:3000

## Deploy to Heroku

**Repo missing?** See **[REPO_SETUP.md](REPO_SETUP.md)** for create → push → deploy steps.

### Option A — One-click (after GitHub push)

```powershell
# From project root (requires GitHub CLI)
.\scripts\push-github.ps1 -RepoName oil-crack-backtest -Public
# commit, push to github.com/salmasaidane/oil-crack-backtest
```

Then click the **Deploy to Heroku** button at the top of this README.

### Option B — CLI script

```powershell
.\scripts\deploy-heroku.ps1 -AppName your-app-name-oil-crack
heroku config:set EIA_API_KEY=your_key -a your-app-name-oil-crack
```

### Option C — Manual

```bash
git init && git add . && git commit -m "Oil crack backtest demo"
heroku create your-app-name-oil-crack
heroku config:set EIA_API_KEY=your_key   # optional
git push heroku main
heroku open
```

Heroku runs `heroku-postbuild` (`npm run build`) then `node server/index.js`.

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health + `eiaConfigured` |
| `/api/data` | GET | Signals + metadata |
| `/api/backtest` | POST | Run backtest (JSON strategy params) |
| `/api/context` | GET | War overlay narrative |

## Strategy parameters (POST `/api/backtest`)

| Field | Default | Description |
|-------|---------|-------------|
| `entryZ` | 0.75 | Enter long when augmented signal exceeds this |
| `exitZ` | 0.15 | Exit when signal falls below |
| `warMaxGpr` | 0.85 | De-risk when GPR exceeds |
| `minConfidence` | 0.35 | Minimum confidence to trade |

**Disclaimer:** Educational demo only — not investment advice.
