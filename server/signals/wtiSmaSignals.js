/**
 * Simple WTI trend strategy: go long when fast SMA crosses above slow SMA, exit when below.
 */

function sma(values, window) {
  const out = new Array(values.length).fill(null);
  for (let i = window - 1; i < values.length; i++) {
    let s = 0;
    for (let j = i - window + 1; j <= i; j++) s += values[j];
    out[i] = s / window;
  }
  return out;
}

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

module.exports = { buildSignals, sma };
