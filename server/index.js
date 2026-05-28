require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { loadMarketData } = require('./data/fetchPrices');
const { buildSignals } = require('./signals/crackWarSignals');
const { runBacktest } = require('./backtest/engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let cache = null;
let cacheTime = 0;
const CACHE_MS = 15 * 60 * 1000;

async function getDataset() {
  if (cache && Date.now() - cacheTime < CACHE_MS) return cache;
  const { series, meta } = await loadMarketData({ days: 504 });
  const signals = buildSignals(series);
  cache = { series, meta, signals };
  cacheTime = Date.now();
  return cache;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'oil-crack-backtest',
    eiaConfigured: Boolean(process.env.EIA_API_KEY?.trim()),
  });
});

app.get('/api/data', async (_req, res) => {
  try {
    const { meta, signals } = await getDataset();
    res.json({ meta, signals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load market data' });
  }
});

app.post('/api/backtest', async (req, res) => {
  try {
    const { signals } = await getDataset();
    const result = runBacktest(signals, req.body || {});
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Backtest failed' });
  }
});

app.get('/api/context', (_req, res) => {
  res.json({
    title: 'US–Iran conflict overlay (demo)',
    narrative: [
      '3-2-1 crack spread z-score drives base positioning in WTI.',
      'Geopolitical risk premium (GPR) ramps from 18 Apr 2026 with Hormuz supply-fear boost.',
      'Extreme GPR (>0.85) triggers de-risk exits even on bullish crack signals.',
    ],
    disclaimer:
      'Educational demo only. Not investment advice. With EIA_API_KEY: WTI, Gulf Coast gasoline & heating oil from EIA; else Stooq WTI + model-derived products.',
    warWindow: { start: '2026-04-18', peak: '2026-05-15' },
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
