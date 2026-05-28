const { sma } = require('./sma');

/** 3-2-1 crack spread in USD per barrel of crude input */
function crack321(wti, rbob, ho) {
  const productValue = (2 * rbob + 1 * ho) * 42;
  return (productValue - 3 * wti) / 3;
}

/**
 * Long WTI when the crack spread trend is up (fast SMA > slow SMA).
 * Idea: widening refining margins often coincide with firm crude demand.
 */
function buildSignals(series, params = {}) {
  const fastPeriod = params.fastPeriod ?? 15;
  const slowPeriod = params.slowPeriod ?? 40;
  const cracks = series.map((r) => crack321(r.wti, r.rbob, r.ho));
  const smaFast = sma(cracks, fastPeriod);
  const smaSlow = sma(cracks, slowPeriod);

  return series.map((row, i) => {
    const f = smaFast[i];
    const s = smaSlow[i];
    const ready = f != null && s != null;
    const bullish = ready && f > s;
    return {
      date: row.date,
      wti: row.wti,
      crack321: Number(cracks[i].toFixed(2)),
      smaFast: f != null ? Number(f.toFixed(2)) : null,
      smaSlow: s != null ? Number(s.toFixed(2)) : null,
      signal: bullish ? 1 : 0,
      trend: bullish ? 'long' : 'flat',
    };
  });
}

module.exports = { buildSignals, crack321 };
