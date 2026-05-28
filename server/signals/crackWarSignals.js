/**
 * 3-2-1 crack spread (USD/bbl) and US–Iran war-context overlay (May 2026 demo).
 * Public narrative: elevated Hormuz / Strait risk, SPR releases, sanctions premia.
 */

const WAR_ESCALATION_START = '2026-04-18';
const WAR_PEAK = '2026-05-15';

function crack321(wti, rbob, ho) {
  // RBOB/HO in $/gal → $/bbl via ×42; 3-2-1: products minus crude input per bbl refined
  const productValue = (2 * rbob + 1 * ho) * 42;
  const crudeInput = 3 * wti;
  return (productValue - crudeInput) / 3;
}

function sma(values, window) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      out.push(null);
      continue;
    }
    let s = 0;
    for (let j = i - window + 1; j <= i; j++) s += values[j];
    out.push(s / window);
  }
  return out;
}

function zScore(series, window) {
  const out = [];
  for (let i = 0; i < series.length; i++) {
    if (i < window - 1) {
      out.push(0);
      continue;
    }
    const slice = series.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / window;
    const std = Math.sqrt(variance) || 1e-6;
    out.push((series[i] - mean) / std);
  }
  return out;
}

function daysBetween(a, b) {
  return (new Date(b) - new Date(a)) / 86400000;
}

function geopoliticalRisk(dateStr) {
  const d = daysBetween(WAR_ESCALATION_START, dateStr);
  if (d < 0) return { gpr: 0.12, hormuz: 0.05, label: 'baseline' };

  const ramp = Math.min(1, Math.max(0, d / 28));
  const peakDist = Math.abs(daysBetween(dateStr, WAR_PEAK));
  const spike = Math.exp(-(peakDist * peakDist) / (2 * 12 * 12));

  const gpr = 0.12 + ramp * 0.55 + spike * 0.25;
  const hormuz = 0.05 + ramp * 0.4 + spike * 0.35;
  const sanctions = ramp * 0.3;

  let label = 'elevated';
  if (gpr > 0.65) label = 'war-premium';
  else if (gpr > 0.35) label = 'escalation';

  return {
    gpr: Math.min(1, gpr),
    hormuz: Math.min(1, hormuz),
    sanctions,
    label,
  };
}

function augmentSignal(baseZ, geo, crack, wti) {
  // War context: positive crack z often means strong refining margins;
  // Hormuz risk adds supply fear → boosts long crude bias but widens vol.
  const supplyFear = geo.hormuz * 0.45 + geo.sanctions * 0.25;
  const marginSignal = baseZ * (1 - geo.gpr * 0.15);
  const warBoost = supplyFear * 0.6 - geo.gpr * 0.2;
  const volPenalty = geo.gpr > 0.5 ? -0.15 : 0;

  const augmented = marginSignal + warBoost + volPenalty;
  const confidence = Math.max(
    0.1,
    Math.min(1, 0.5 + Math.abs(baseZ) * 0.15 + geo.gpr * 0.2 - geo.hormuz * 0.1)
  );

  return {
    baseZ: marginSignal,
    augmentedZ: augmented,
    confidence,
    regime: geo.label,
    crack,
    wti,
    geo,
  };
}

function buildSignals(series) {
  const cracks = series.map((r) => crack321(r.wti, r.rbob, r.ho));
  const crackSma20 = sma(cracks, 20);
  const crackZ = zScore(cracks, 40);

  return series.map((row, i) => {
    const geo = geopoliticalRisk(row.date);
    const sig = augmentSignal(crackZ[i], geo, cracks[i], row.wti);
    return {
      date: row.date,
      wti: row.wti,
      rbob: row.rbob,
      ho: row.ho,
      crack321: Number(cracks[i].toFixed(2)),
      crackSma20: crackSma20[i] != null ? Number(crackSma20[i].toFixed(2)) : null,
      crackZ: Number(crackZ[i].toFixed(3)),
      signal: Number(sig.augmentedZ.toFixed(3)),
      baseSignal: Number(sig.baseZ.toFixed(3)),
      confidence: Number(sig.confidence.toFixed(3)),
      regime: sig.regime,
      gpr: Number(geo.gpr.toFixed(3)),
      hormuzRisk: Number(geo.hormuz.toFixed(3)),
    };
  });
}

module.exports = { buildSignals, crack321, geopoliticalRisk };
