require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { loadMarketData } = require('./data/fetchPrices');
const { buildSignals } = require('./signals/wtiSmaSignals');
const { runBacktest } = require('./backtest/engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let cache = null;
const CACHE_MS = 15 * 60 * 1000;

const DEFAULT_PARAMS = { fastPeriod: 20, slowPeriod: 50 };

async function getMarket() {
  if (cache && Date.now() - cache.time < CACHE_MS) return cache;
  const { series, meta } = await loadMarketData({ days: 504 });
  cache = { series, meta, time: Date.now() };
  return cache;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'oil-crack-backtest',
    strategy: 'wti-sma-crossover',
    eiaConfigured: Boolean(process.env.EIA_API_KEY?.trim()),
  });
});

app.get('/api/data', async (_req, res) => {
  try {
    const { series, meta } = await getMarket();
    const signals = buildSignals(series, DEFAULT_PARAMS);
    res.json({
      meta: { ...meta, strategy: 'WTI SMA crossover' },
      signals,
      params: DEFAULT_PARAMS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load market data' });
  }
});

app.post('/api/backtest', async (req, res) => {
  try {
    const params = { ...DEFAULT_PARAMS, ...(req.body || {}) };
    const { series } = await getMarket();
    const signals = buildSignals(series, params);
    const result = runBacktest(signals, params);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Backtest failed' });
  }
});

app.get('/api/context', (_req, res) => {
  res.json({
    title: 'WTI SMA crossover',
    narrative: [
      'Long 1×1000 bbl WTI when the fast SMA is above the slow SMA.',
      'Go flat when the fast SMA drops below the slow SMA.',
      'Defaults: 20-day fast, 50-day slow — classic trend-following on crude.',
    ],
    disclaimer:
      'Educational demo only. Not investment advice. Past backtests do not guarantee future results.',
  });
});

const dist = path.join(__dirname, '..', 'dist');
app.use(express.static(dist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) res.status(404).send('Build the client: npm run build');
  });
});

app.listen(PORT, () => {
  console.log(`oil-crack-backtest listening on ${PORT}`);
});
