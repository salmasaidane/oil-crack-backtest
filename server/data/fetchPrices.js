const seedrandom = require('seedrandom');
const { loadEiaMarketData } = require('./eia');

const STOOQ_WTI = 'https://stooq.com/q/d/l/?s=cl.f&i=d';
const STOOQ_BRENT = 'https://stooq.com/q/d/l/?s=cb.f&i=d';

function parseStooqCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, open, high, low, close, volume] = lines[i].split(',');
    if (!date || !close) continue;
    const c = parseFloat(close);
    if (!Number.isFinite(c) || c <= 0) continue;
    rows.push({
      date,
      open: parseFloat(open) || c,
      high: parseFloat(high) || c,
      low: parseFloat(low) || c,
      close: c,
      volume: parseFloat(volume) || 0,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchStooq(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'oil-crack-backtest/1.0' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
  return parseStooqCsv(await res.text());
}

function businessDays(endDate, count) {
  const out = [];
  const d = new Date(endDate);
  while (out.length < count) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      out.unshift(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() - 1);
  }
  return out;
}

function generateSyntheticSeries(dates, baseWti, rng) {
  let wti = baseWti;
  let rbob = baseWti * 1.12;
  let ho = baseWti * 1.05;
  const rows = [];
  for (const date of dates) {
    const shock = (rng() - 0.5) * 2.8;
    const trend = Math.sin(dates.indexOf(date) / 45) * 0.4;
    wti = Math.max(35, wti + shock + trend);
    rbob = Math.max(40, rbob + shock * 1.05 + (rng() - 0.5) * 1.2);
    ho = Math.max(38, ho + shock * 0.9 + (rng() - 0.5) * 1.0);
    rows.push({ date, wti, rbob, ho, source: 'synthetic' });
  }
  return rows;
}

function alignWtiWithProducts(wtiRows, productRows) {
  const byDate = new Map(productRows.map((r) => [r.date, r]));
  return wtiRows
    .map((w) => {
      const p = byDate.get(w.date);
      if (!p) return null;
      return {
        date: w.date,
        wti: w.close ?? w.wti,
        rbob: p.rbob,
        ho: p.ho,
        volume: w.volume ?? 0,
        source: [w.source, p.source].filter(Boolean).join('+') || 'merged',
      };
    })
    .filter(Boolean);
}

function deriveProductsFromWti(wtiRows, rng) {
  return wtiRows.map((w, i) => {
    const season = Math.sin((i / 252) * Math.PI * 2) * 2.5;
    const rbob = w.close * (1.08 + season * 0.01) + (rng() - 0.5) * 1.5;
    const ho = w.close * (1.02 + season * 0.008) + (rng() - 0.5) * 1.2;
    return {
      date: w.date,
      rbob: Math.max(30, rbob),
      ho: Math.max(28, ho),
      source: 'derived',
    };
  });
}

function eiaRowsToSeries(rows) {
  return rows.map((r) => ({
    date: r.date,
    wti: r.wti,
    rbob: r.rbob,
    ho: r.ho,
    volume: r.volume ?? 0,
    source: r.source,
  }));
}

/**
 * Priority: EIA (if EIA_API_KEY) → Stooq WTI + derived products → full synthetic.
 */
async function loadMarketData({ days = 504 } = {}) {
  const rng = seedrandom('oil-crack-v1');
  const eiaKey = process.env.EIA_API_KEY?.trim();
  let brentPremium = 3.5;
  let eiaSeries = null;

  if (eiaKey) {
    try {
      const eia = await loadEiaMarketData(eiaKey, { days });
      if (eia?.rows?.length >= 30) {
        const series = eiaRowsToSeries(eia.rows);
        try {
          const brent = await fetchStooq(STOOQ_BRENT);
          if (brent.length > 10) {
            brentPremium =
              brent[brent.length - 1].close - series[series.length - 1].wti;
          }
        } catch {
          /* optional */
        }
        return {
          series,
          meta: {
            dataSource: 'eia',
            eiaConfigured: true,
            eiaSeries: eia.seriesUsed,
            brentPremium: Number(brentPremium.toFixed(2)),
            rows: series.length,
            from: series[0]?.date,
            to: series[series.length - 1]?.date,
          },
        };
      }
    } catch (err) {
      console.warn('EIA fetch failed, falling back:', err.message);
      eiaSeries = err.message;
    }
  }

  let wtiRows = [];
  let dataSource = 'synthetic';

  try {
    wtiRows = await fetchStooq(STOOQ_WTI);
    if (wtiRows.length > 30) {
      dataSource = 'stooq-wti';
      wtiRows = wtiRows.slice(-days).map((r) => ({ ...r, source: 'stooq' }));
    } else {
      throw new Error('insufficient WTI rows');
    }
  } catch {
    const dates = businessDays(new Date(), days);
    wtiRows = generateSyntheticSeries(dates, 72, rng).map((r) => ({
      date: r.date,
      close: r.wti,
      open: r.wti,
      high: r.wti * 1.01,
      low: r.wti * 0.99,
      volume: 200000 + rng() * 50000,
      source: 'synthetic',
    }));
    dataSource = 'synthetic';
  }

  try {
    const brent = await fetchStooq(STOOQ_BRENT);
    if (brent.length > 10) {
      brentPremium =
        brent[brent.length - 1].close - wtiRows[wtiRows.length - 1].close;
      dataSource += '+brent-spread';
    }
  } catch {
    /* optional */
  }

  const productSynth = deriveProductsFromWti(wtiRows, rng);
  const series = alignWtiWithProducts(
    wtiRows,
    productSynth.map((p) => ({
      date: p.date,
      rbob: p.rbob,
      ho: p.ho,
      source: p.source,
    }))
  );

  return {
    series,
    meta: {
      dataSource,
      eiaConfigured: Boolean(eiaKey),
      eiaError: eiaKey && eiaSeries ? eiaSeries : undefined,
      brentPremium: Number(brentPremium.toFixed(2)),
      rows: series.length,
      from: series[0]?.date,
      to: series[series.length - 1]?.date,
    },
  };
}

module.exports = { loadMarketData, businessDays };
