/**
 * EIA Open Data v2 — Gulf Coast spot prices (petroleum/pri/spt).
 * https://www.eia.gov/opendata/register.php
 *
 * Use facets[series][] on pri/spt (not /seriesid/ — petroleum IDs 404 there).
 */

const SPT_DATA = 'https://api.eia.gov/v2/petroleum/pri/spt/data/';

/** Daily spot series (v1-style IDs work as series facet on pri/spt) */
const SERIES = {
  wti: ['PET.RWTC.D'],
  rbob: [
    'PET.EER_EPMRU_PF4_RGC_DPG.D',
    'PET.EMD_EPMRU_PF4_RGC_DPG.D',
  ],
  ho: [
    'PET.EER_EPD2D_PF4_RGC_DPG.D',
    'PET.EMD_EPD2D_PTE_RGC_DPG.D',
    'PET.EER_EPD2DXL0_PF4_RGC_DPG.D',
  ],
};

async function fetchSptSeries(apiKey, seriesId, { start, length = 5000 } = {}) {
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

  const url = `${SPT_DATA}?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  const bodyText = await res.text();

  if (!res.ok) {
    throw new Error(`EIA ${seriesId} HTTP ${res.status}: ${bodyText.slice(0, 150)}`);
  }

  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new Error(`EIA ${seriesId}: invalid JSON`);
  }

  const rows = json?.response?.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`EIA ${seriesId}: empty response`);
  }

  return rows
    .map((r) => ({
      date: String(r.period).slice(0, 10),
      value: parseFloat(r.value),
    }))
    .filter((r) => r.date && Number.isFinite(r.value) && r.value > 0);
}

async function fetchFirstWorking(apiKey, seriesIds, opts) {
  let lastErr;
  for (const id of seriesIds) {
    try {
      const rows = await fetchSptSeries(apiKey, id, opts);
      return { rows, seriesId: id };
    } catch (e) {
      lastErr = e;
      console.warn(`EIA try ${id}:`, e.message);
    }
  }
  throw lastErr || new Error('EIA: no series matched');
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

async function loadEiaMarketData(apiKey, { days = 504 } = {}) {
  if (!apiKey) return null;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Math.ceil(days * 1.8));
  const start = startDate.toISOString().slice(0, 10);
  const opts = { start };

  const wtiR = await fetchFirstWorking(apiKey, SERIES.wti, opts);
  const rbobR = await fetchFirstWorking(apiKey, SERIES.rbob, opts);
  const hoR = await fetchFirstWorking(apiKey, SERIES.ho, opts);

  let merged = mergeEiaSeries(wtiR.rows, rbobR.rows, hoR.rows);
  if (merged.length < 30) return null;

  merged = merged.slice(-days);
  const seriesUsed = [wtiR.seriesId, rbobR.seriesId, hoR.seriesId];

  return {
    rows: merged.map((r) => ({
      date: r.date,
      wti: r.wti,
      rbob: r.rbob,
      ho: r.ho,
      volume: 0,
      source: 'eia',
    })),
    seriesUsed,
  };
}

module.exports = { loadEiaMarketData, SERIES };
