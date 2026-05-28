/**
 * EIA Open Data — Gulf Coast spot prices for crack / spread backtests.
 * https://www.eia.gov/opendata/register.php
 *
 * Uses v2 /seriesid/ (legacy PET.* daily series) — reliable for spot prices.
 */

const SERIESID = {
  wti: 'PET.RWTC.D',
  /** Gulf Coast conventional gasoline regular spot ($/gal) */
  rbob: 'PET.EER_EPMRU_PF4_RGC_DPG.D',
  /** Gulf Coast No. 2 heating oil spot ($/gal) — distillate/ULSD proxy */
  ho: 'PET.EER_EPD2D_PF4_RGC_DPG.D',
};

const SERIESID_ALT = {
  ho: 'PET.EMD_EPD2D_PTE_RGC_DPG.D',
};

async function fetchEiaSeriesId(apiKey, seriesId, { start, length = 5000 } = {}) {
  const params = new URLSearchParams({
    api_key: apiKey,
    'data[0]': 'value',
    'sort[0][column]': 'period',
    'sort[0][direction]': 'asc',
    length: String(length),
    offset: '0',
  });
  if (start) params.set('start', start);

  const url = `https://api.eia.gov/v2/seriesid/${encodeURIComponent(seriesId)}/data/?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`EIA ${seriesId} HTTP ${res.status}: ${body.slice(0, 150)}`);
  }

  const json = await res.json();
  const rows = json?.response?.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`EIA ${seriesId}: empty response`);
  }

  return rows
    .map((r) => ({
      date: r.period?.slice(0, 10),
      value: parseFloat(r.value),
    }))
    .filter((r) => r.date && Number.isFinite(r.value) && r.value > 0);
}

async function fetchWithAlt(apiKey, primary, alt, opts) {
  try {
    return await fetchEiaSeriesId(apiKey, primary, opts);
  } catch (e1) {
    if (alt) {
      return fetchEiaSeriesId(apiKey, alt, opts);
    }
    throw e1;
  }
}

function mergeEiaSeries(wti, rbob, ho) {
  const maps = {
    wti: new Map(wti.map((r) => [r.date, r.value])),
    rbob: new Map(rbob.map((r) => [r.date, r.value])),
    ho: new Map(ho.map((r) => [r.date, r.value])),
  };
  const dates = [...maps.wti.keys()].filter(
    (d) => maps.rbob.has(d) && maps.ho.has(d)
  );
  dates.sort();
  return dates.map((date) => ({
    date,
    wti: maps.wti.get(date),
    rbob: maps.rbob.get(date),
    ho: maps.ho.get(date),
    source: 'eia',
  }));
}

/**
 * @returns {Promise<{ rows: object[], seriesUsed: string[], partial?: boolean } | null>}
 */
async function loadEiaMarketData(apiKey, { days = 504 } = {}) {
  if (!apiKey) return null;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Math.ceil(days * 1.8));
  const start = startDate.toISOString().slice(0, 10);
  const opts = { start };

  const [wti, rbob, ho] = await Promise.all([
    fetchEiaSeriesId(apiKey, SERIESID.wti, opts),
    fetchEiaSeriesId(apiKey, SERIESID.rbob, opts),
    fetchWithAlt(apiKey, SERIESID.ho, SERIESID_ALT.ho, opts),
  ]);

  let merged = mergeEiaSeries(wti, rbob, ho);
  if (merged.length < 30) return null;

  merged = merged.slice(-days);
  return {
    rows: merged.map((r) => ({
      date: r.date,
      wti: r.wti,
      rbob: r.rbob,
      ho: r.ho,
      volume: 0,
      source: 'eia',
    })),
    seriesUsed: [SERIESID.wti, SERIESID.rbob, SERIESID.ho],
  };
}

/**
 * Load individual EIA legs (for hybrid with Stooq WTI).
 */
async function loadEiaLegs(apiKey, { days = 504 } = {}) {
  const full = await loadEiaMarketData(apiKey, { days });
  if (!full) return null;
  return {
    wti: full.rows.map((r) => ({ date: r.date, value: r.wti })),
    rbob: full.rows.map((r) => ({ date: r.date, value: r.rbob })),
    ho: full.rows.map((r) => ({ date: r.date, value: r.ho })),
    seriesUsed: full.seriesUsed,
  };
}

module.exports = { loadEiaMarketData, loadEiaLegs, SERIESID };
