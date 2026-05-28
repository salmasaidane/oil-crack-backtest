require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { loadMarketData } = require('./data/fetchPrices');
const { getStrategy, STRATEGIES } = require('./signals');
const { runBacktest } = require('./backtest/engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let cache = null;
const CACHE_MS = 15 * 60 * 1000;

async function getMarket() {
  if (cache && Date.now() - cache.time < CACHE_MS) return cache;
  const { series, meta } = await loadMarketData({ days: 504 });
  cache = { series, meta, time: Date.now() };
  return cache;
}

function resolveParams(queryOrBody) {
  const strategyKey = queryOrBody.strategy === 'wti' ? 'wti' : 'crack';
  const strat = getStrategy(strategyKey);
  return {
    strategy: strategyKey,
    ...strat.defaults,
    ...queryOrBody,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'oil-crack-backtest',
    strategies: Object.keys(STRATEGIES),
    eiaConfigured: Boolean(process.env.EIA_API_KEY?.trim()),
  });
});

app.get('/api/data', async (req, res) => {
  try {
    const params = resolveParams(req.query);
    const strat = getStrategy(params.strategy);
    const { series, meta } = await getMarket();
    const signals = strat.buildSignals(series, params);
    res.json({
      meta: { ...meta, strategy: strat.label, strategyId: params.strategy },
      signals,
      params,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load market data' });
  }
});

app.post('/api/backtest', async (req, res) => {
  try {
    const params = resolveParams(req.body || {});
    const strat = getStrategy(params.strategy);
    const { series } = await getMarket();
    const signals = strat.buildSignals(series, params);
    const result = runBacktest(signals, {
      ...params,
      strategyLabel: strat.summary,
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Backtest failed' });
  }
});

app.get('/api/context', (req, res) => {
  const key = req.query.strategy === 'wti' ? 'wti' : 'crack';
  if (key === 'wti') {
    return res.json({
      title: 'WTI SMA crossover',
      narrative: [
        'Long 1×1,000 bbl WTI when the fast SMA of WTI is above the slow SMA.',
        'Go flat when fast drops below slow.',
        'Classic crude trend-following.',
      ],
      disclaimer:
        'Educational demo only. Not investment advice.',
    });
  }
  res.json({
    title: '3-2-1 crack SMA crossover',
    narrative: [
      'Crack = refining margin proxy: (2×gasoline + 1×heating oil)×42 − 3×WTI, per bbl.',
      'Long WTI when the fast SMA of the crack is above the slow SMA (widening margins).',
      'Go flat when the crack trend turns down.',
    ],
    disclaimer:
      'Educational demo only. Not investment advice. Products from EIA or model-derived from WTI.',
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
