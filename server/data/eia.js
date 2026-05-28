/**
 * EIA Open Data v2 — US Gulf Coast spot prices for 3-2-1 crack inputs.
 * Register free key: https://www.eia.gov/opendata/register.php
 *
 * Series (petroleum/pri/spt, daily $/unit as published):
 * - RWTC   WTI Cushing spot ($/bbl)
 * - RFGCUD Gulf Coast conventional gasoline regular ($/gal)
 * - NUSHHO Gulf Coast No. 2 heating oil ($/gal)
 */

const EIA_BASE = 'https://api.eia.gov/v2/petroleum/pri/spt/data/';

const SERIES = {
  wti: 'RWTC',
  rbob: 'RFGCUD',
  ho: 'NUSHHO',
};

async function fetchEiaSeries(apiKey, seriesId, { start, length = 5000 } = {}) {
  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: 'daily',
    'data[0]': 'value',
    'facets[series][]': seriesId,
    'sort[0][column]': 'period',
    'sort[0][direction]': 'asc',
    length: String(length),
    offset: '0',
  });
  if (start) params.set('start', start);

  const url = `${EIA_BASE}?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`EIA ${seriesId} HTTP ${res.status}: ${body.slice(0, 120)}`);
  }

  const json = await res.json();
  const rows = json?.response?.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`EIA ${seriesId}: empty response`);
  }

  return rows
    .map((r) => ({
      date: r.period,
      value: parseFloat(r.value),
    }))
    .filter((r) => r.date && Number.isFinite(r.value) && r.value > 0);
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
 * @returns {Promise<{ rows: object[], seriesUsed: string[] } | null>}
 */
async function loadEiaMarketData(apiKey, { days = 504 } = {}) {
  if (!apiKey) return null;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Math.ceil(days * 1.6));
  const start = startDate.toISOString().slice(0, 10);

  const [wti, rbob, ho] = await Promise.all([
    fetchEiaSeries(apiKey, SERIES.wti, { start }),
    fetchEiaSeries(apiKey, SERIES.rbob, { start }),
    fetchEiaSeries(apiKey, SERIES.ho, { start }),
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
    seriesUsed: Object.values(SERIES),
  };
}

module.exports = { loadEiaMarketData, SERIES };
