/**
 * EIA Open Data — Gulf Coast spot (WTI, gasoline, distillate).
 * Tries v2 pri/spt (series + product/duoarea facets) and v1 series API.
 */

const SPT_DATA = 'https://api.eia.gov/v2/petroleum/pri/spt/data/';
const V1_SERIES = 'https://api.eia.gov/v1/series/';

const LEG_CONFIG = {
  wti: {
    v2Series: ['RWTC', 'PET.RWTC.D'],
    v1Series: ['PET.RWTC.D'],
    facets: [],
    unit: 'bbl',
  },
  rbob: {
    v2Series: [
      'GASUSGCD',
      'EER_EPMRU_PF4_RGC_DPG',
      'PET.EER_EPMRU_PF4_RGC_DPG.D',
      'RFGCUD',
    ],
    v1Series: ['PET.EER_EPMRU_PF4_RGC_DPG.D'],
    facets: [
      { duoarea: 'RGC', product: 'EPMRU' },
      { duoarea: 'RGC', product: 'EPMRR' },
    ],
    unit: 'gal',
  },
  ho: {
    v2Series: [
      'DIUSGCD',
      'EER_EPD2DXL0_PF4_RGC_DPG',
      'EER_EPD2D_PF4_RGC_DPG',
      'NUSHHO',
      'PET.EER_EPD2D_PF4_RGC_DPG.D',
      'PET.EMD_EPD2D_PTE_RGC_DPG.D',
    ],
    v1Series: [
      'PET.EER_EPD2DXL0_PF4_RGC_DPG.D',
      'PET.EER_EPD2D_PF4_RGC_DPG.D',
      'PET.EMD_EPD2D_PTE_RGC_DPG.D',
    ],
    facets: [
      { duoarea: 'RGC', product: 'EPD2DXL0' },
      { duoarea: 'RGC', product: 'EPD2D' },
    ],
    unit: 'gal',
  },
};

function parseRows(rows) {
  return rows
    .map((r) => ({
      date: String(r.period ?? r.date ?? r[0]).slice(0, 10),
      value: parseFloat(r.value ?? r[1]),
    }))
    .filter((r) => r.date && Number.isFinite(r.value) && r.value > 0);
}

async function fetchV2Spt(apiKey, { seriesId, facets = {} }, opts) {
  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: 'daily',
    'data[0]': 'value',
    'sort[0][column]': 'period',
    'sort[0][direction]': 'asc',
    length: String(opts.length ?? 5000),
    offset: '0',
  });
  if (opts.start) params.set('start', opts.start);
  if (seriesId) params.append('facets[series][]', seriesId);
  for (const [k, v] of Object.entries(facets)) {
    params.append(`facets[${k}][]`, v);
  }

  const url = `${SPT_DATA}?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`v2 ${seriesId || JSON.stringify(facets)} HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const json = JSON.parse(text);
  const rows = parseRows(json?.response?.data ?? []);
  if (!rows.length) throw new Error(`v2 ${seriesId || 'facets'}: empty`);
  return rows;
}

async function fetchV1Series(apiKey, seriesId, opts) {
  const params = new URLSearchParams({
    api_key: apiKey,
    series_id: seriesId,
  });
  const url = `${V1_SERIES}?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`v1 ${seriesId} HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const json = JSON.parse(text);
  const raw = json?.series?.[0]?.data ?? json?.response?.data ?? [];
  const rows = raw
    .map((pair) => {
      const d = String(pair[0]);
      const date =
        d.length === 8
          ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
          : d.slice(0, 10);
      return { date, value: parseFloat(pair[1]) };
    })
    .filter((r) => r.date && Number.isFinite(r.value) && r.value > 0);
  if (!rows.length) throw new Error(`v1 ${seriesId}: empty`);
  if (opts.start) {
    return rows.filter((r) => r.date >= opts.start);
  }
  return rows;
}

async function fetchLeg(apiKey, legKey, opts) {
  const cfg = LEG_CONFIG[legKey];
  let lastErr;

  for (const id of cfg.v2Series) {
    try {
      const rows = await fetchV2Spt(apiKey, { seriesId: id }, opts);
      return { rows, source: `v2:${id}` };
    } catch (e) {
      lastErr = e;
    }
  }

  for (const facets of cfg.facets) {
    try {
      const rows = await fetchV2Spt(apiKey, { facets }, opts);
      return { rows, source: `v2:${facets.duoarea}+${facets.product}` };
    } catch (e) {
      lastErr = e;
    }
  }

  for (const id of cfg.v1Series) {
    try {
      const rows = await fetchV1Series(apiKey, id, opts);
      return { rows, source: `v1:${id}` };
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error(`EIA ${legKey}: all methods failed`);
}

function mergeLegs(wti, rbob, ho) {
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
  const opts = { start: startDate.toISOString().slice(0, 10) };

  const wtiR = await fetchLeg(apiKey, 'wti', opts);
  const rbobR = await fetchLeg(apiKey, 'rbob', opts);
  const hoR = await fetchLeg(apiKey, 'ho', opts);

  let merged = mergeLegs(wtiR.rows, rbobR.rows, hoR.rows);
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
    seriesUsed: [wtiR.source, rbobR.source, hoR.source],
  };
}

/** Fetch product legs only (for Stooq WTI hybrid). */
async function loadEiaProducts(apiKey, opts) {
  const rbobR = await fetchLeg(apiKey, 'rbob', opts);
  const hoR = await fetchLeg(apiKey, 'ho', opts);
  return { rbob: rbobR, ho: hoR };
}

module.exports = { loadEiaMarketData, loadEiaProducts, fetchLeg, LEG_CONFIG };
