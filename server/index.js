require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { loadMarketData } = require('./data/fetchPrices');
const { getStrategy, STRATEGIES } = require('./signals');
const { runBacktest } = require('./backtest/engine');
const { runSpreadBacktest } = require('./backtest/spreadEngine');

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
  const strategyKey =
    queryOrBody.strategy && STRATEGIES[queryOrBody.strategy]
      ? queryOrBody.strategy
      : 'spread';
  const strat = getStrategy(strategyKey);
  return {
    strategy: strategyKey,
    ...strat.defaults,
    ...queryOrBody,
  };
}

function runForStrategy(signals, params, strat) {
  if (strat.engine === 'spread') {
    return runSpreadBacktest(signals, {
      ...params,
      strategyLabel: strat.summary,
    });
  }
  return runBacktest(signals, {
    ...params,
    strategyLabel: strat.summary,
  });
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
      meta: {
        ...meta,
        strategy: strat.label,
        strategyId: params.strategy,
        productsNote:
          meta.dataSource === 'eia'
            ? 'EIA Gulf Coast spot: RFGCUD gasoline, NUSHHO distillate (No.2 heating oil proxy)'
            : 'Stooq WTI + model gasoline/distillate from crude',
      },
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
    const result = runForStrategy(signals, params, strat);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Backtest failed' });
  }
});

app.get('/api/context', (req, res) => {
  const key = req.query.strategy && STRATEGIES[req.query.strategy]
    ? req.query.strategy
    : 'spread';

  if (key === 'spread') {
    return res.json({
      title: 'Distillate vs gasoline crack (US–Iran / Hormuz context)',
      narrative: [
        'Gasoline crack (RBOB proxy): Gulf Coast regular gasoline × 42 − WTI.',
        'Distillate crack: Gulf Coast No.2 heating oil × 42 − WTI (EIA distillate proxy; tracks ULSD direction).',
        'Spread = distillate crack − gasoline crack. When it widens, middle distillates are outperforming light ends.',
        'Strategy: long the spread when fast SMA > slow SMA (ride distillate strength); flat when trend reverses.',
        'Motivation: summer gasoline demand vs diesel/ULSD tightness from disrupted routes and elevated military/logistics demand in the US–Iran conflict.',
      ],
      disclaimer:
        'Educational backtest only. Uses EIA public spot series when EIA_API_KEY is set; otherwise Stooq WTI with model product legs. Not trading advice.',
      dataSources: [
        'https://www.eia.gov/opendata/ — PET.RWTC.D, PET.EER_EPMRU_PF4_RGC_DPG.D, PET.EER_EPD2D_PF4_RGC_DPG.D',
        'https://www.eia.gov/petroleum/gasdiesel/',
      ],
    });
  }

  if (key === 'wti') {
    return res.json({
      title: 'WTI SMA crossover',
      narrative: [
        'Long 1×1,000 bbl WTI when fast SMA > slow SMA on WTI spot.',
        'Flat when fast < slow.',
      ],
      disclaimer: 'Educational demo only. Not investment advice.',
    });
  }

  res.json({
    title: '3-2-1 crack SMA crossover',
    narrative: [
      'Crack = (2×gasoline + 1×heating oil)×42 − 3×WTI per bbl.',
      'Long WTI when fast SMA of crack > slow SMA.',
    ],
    disclaimer: 'Educational demo only. Not investment advice.',
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
