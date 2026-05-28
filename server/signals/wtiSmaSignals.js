const { sma } = require('./sma');

function buildSignals(series, params = {}) {
  const fastPeriod = params.fastPeriod ?? 20;
  const slowPeriod = params.slowPeriod ?? 50;
  const prices = series.map((r) => r.wti);
  const smaFast = sma(prices, fastPeriod);
  const smaSlow = sma(prices, slowPeriod);

  return series.map((row, i) => {
    const f = smaFast[i];
    const s = smaSlow[i];
    const ready = f != null && s != null;
    const bullish = ready && f > s;
    return {
      date: row.date,
      wti: row.wti,
      smaFast: f != null ? Number(f.toFixed(2)) : null,
      smaSlow: s != null ? Number(s.toFixed(2)) : null,
      signal: bullish ? 1 : 0,
      trend: bullish ? 'long' : 'flat',
    };
  });
}

module.exports = { buildSignals };
