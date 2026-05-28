const { sma } = require('./sma');
const { productCrack } = require('./cracks');

/**
 * Distillate vs gasoline crack spread (Gulf Coast proxy, $/bbl).
 * Long spread = long distillate crack, short gasoline crack (1:1 on crack legs).
 *
 * Data: EIA spot RFGCUD (gasoline) & NUSHHO (No.2 heating oil / distillate proxy).
 */
function buildSignals(series, params = {}) {
  const fastPeriod = params.fastPeriod ?? 10;
  const slowPeriod = params.slowPeriod ?? 30;

  const gasCracks = [];
  const distCracks = [];
  const spreads = [];

  for (const row of series) {
    const gas = productCrack(row.rbob, row.wti);
    const dist = productCrack(row.ho, row.wti);
    gasCracks.push(gas);
    distCracks.push(dist);
    spreads.push(dist - gas);
  }

  const smaFast = sma(spreads, fastPeriod);
  const smaSlow = sma(spreads, slowPeriod);

  return series.map((row, i) => {
    const f = smaFast[i];
    const s = smaSlow[i];
    const ready = f != null && s != null;
    const bullish = ready && f > s;
    return {
      date: row.date,
      wti: row.wti,
      rbob: row.rbob,
      ho: row.ho,
      gasCrack: Number(gasCracks[i].toFixed(2)),
      distCrack: Number(distCracks[i].toFixed(2)),
      spread: Number(spreads[i].toFixed(2)),
      smaFast: f != null ? Number(f.toFixed(2)) : null,
      smaSlow: s != null ? Number(s.toFixed(2)) : null,
      signal: bullish ? 1 : 0,
      trend: bullish ? 'long spread' : 'flat',
    };
  });
}

module.exports = { buildSignals };
