import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const DEFAULT_PARAMS = {
  entryZ: 0.75,
  exitZ: 0.15,
  warMaxGpr: 0.85,
  minConfidence: 0.35,
};

function formatPct(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export default function App() {
  const [meta, setMeta] = useState(null);
  const [signals, setSignals] = useState([]);
  const [context, setContext] = useState(null);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dataRes, ctxRes] = await Promise.all([
        fetch('/api/data'),
        fetch('/api/context'),
      ]);
      if (!dataRes.ok) throw new Error('Data API failed');
      const data = await dataRes.json();
      setMeta(data.meta);
      setSignals(data.signals || []);
      if (ctxRes.ok) setContext(await ctxRes.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const runBacktest = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Backtest failed');
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, [params]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (signals.length > 0 && !result && !running) {
      runBacktest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial backtest once data arrives
  }, [signals.length]);

  const chartData = useMemo(
    () =>
      signals.map((s) => ({
        date: s.date.slice(5),
        wti: s.wti,
        crack: s.crack321,
        signal: s.signal,
        gpr: s.gpr * 100,
        hormuz: s.hormuzRisk * 100,
      })),
    [signals]
  );

  const equityData = useMemo(
    () =>
      (result?.equity || []).map((e) => ({
        date: e.date.slice(5),
        equity: e.equity,
        position: e.position,
      })),
    [result]
  );

  if (loading) return <div className="loading">Loading market data…</div>;
  if (error && !signals.length)
    return (
      <div className="error">
        {error}
        <br />
        <button className="primary" onClick={loadData} style={{ width: 'auto', marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );

  const summary = result?.summary;

  return (
    <div className="app">
      <header>
        <h1>Oil Crack Quant Backtester</h1>
        <p>
          3-2-1 refining crack signals augmented for US–Iran escalation (Hormuz risk, GPR overlay).
          With EIA_API_KEY: EIA spot WTI, gasoline & heating oil; else Stooq WTI + model products.
        </p>
        <div className="badge-row">
          <span className="badge accent">Source: {meta?.dataSource}</span>
          {meta?.eiaConfigured && (
            <span className="badge accent">
              EIA {meta?.dataSource === 'eia' ? 'live' : 'key set'}
            </span>
          )}
          {meta?.eiaError && (
            <span className="badge warn" title={meta.eiaError}>
              EIA fallback
            </span>
          )}
          <span className="badge">{meta?.from} → {meta?.to}</span>
          <span className="badge warn">War window: Apr–May 2026</span>
          <span className="badge">Brent prem: ${meta?.brentPremium}/bbl</span>
        </div>
      </header>

      <div className="grid grid-2">
        <aside className="panel">
          <h2>Strategy parameters</h2>
          {[
            { key: 'entryZ', label: 'Long entry (signal Z)', min: 0.3, max: 1.5, step: 0.05 },
            { key: 'exitZ', label: 'Exit (signal Z)', min: -0.5, max: 0.5, step: 0.05 },
            { key: 'warMaxGpr', label: 'War de-risk GPR', min: 0.5, max: 1, step: 0.05 },
            { key: 'minConfidence', label: 'Min confidence', min: 0.1, max: 0.9, step: 0.05 },
          ].map(({ key, label, min, max, step }) => (
            <div className="field" key={key}>
              <label>
                {label}
                <span className="val">{params[key]}</span>
              </label>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={params[key]}
                onChange={(e) =>
                  setParams((p) => ({ ...p, [key]: parseFloat(e.target.value) }))
                }
              />
            </div>
          ))}
          <button className="primary" onClick={runBacktest} disabled={running}>
            {running ? 'Running…' : 'Run backtest'}
          </button>

          {context && (
            <>
              <h2 style={{ marginTop: '1.25rem' }}>War overlay logic</h2>
              <ul className="context-list">
                {context.narrative.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </>
          )}
        </aside>

        <main>
          {summary && (
            <div className="metrics">
              <div className="metric">
                <div className="label">Total return</div>
                <div
                  className={`value ${summary.totalReturnPct >= 0 ? 'positive' : 'negative'}`}
                >
                  {formatPct(summary.totalReturnPct)}
                </div>
              </div>
              <div className="metric">
                <div className="label">Sharpe (ann.)</div>
                <div className="value">{summary.sharpe}</div>
              </div>
              <div className="metric">
                <div className="label">Max drawdown</div>
                <div className="value negative">{formatPct(summary.maxDrawdownPct)}</div>
              </div>
              <div className="metric">
                <div className="label">Trades / win %</div>
                <div className="value">
                  {summary.trades} / {summary.winRatePct}%
                </div>
              </div>
              <div className="metric">
                <div className="label">Final equity</div>
                <div className="value">
                  ${summary.finalEquity.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          <div className="panel">
            <h2>WTI & 3-2-1 crack ($/bbl)</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid stroke="#243038" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: '#8a9aa8', fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fill: '#8a9aa8', fontSize: 10 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: '#8a9aa8', fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#141a20',
                      border: '1px solid #243038',
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="wti"
                    name="WTI"
                    stroke="#3d9a8b"
                    dot={false}
                    strokeWidth={1.5}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="crack"
                    name="Crack 3-2-1"
                    stroke="#c9a227"
                    dot={false}
                    strokeWidth={1.5}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <h2>Augmented signal & geopolitical risk (%)</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#243038" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: '#8a9aa8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#8a9aa8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#141a20',
                      border: '1px solid #243038',
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="signal"
                    name="Augmented Z"
                    stroke="#4caf82"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="gpr"
                    name="GPR index"
                    stroke="#c45c4a"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="hormuz"
                    name="Hormuz risk"
                    stroke="#8a9aa8"
                    dot={false}
                    strokeDasharray="4 4"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {equityData.length > 0 && (
            <div className="panel">
              <h2>Equity curve (USD)</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData}>
                    <CartesianGrid stroke="#243038" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: '#8a9aa8', fontSize: 10 }} />
                    <YAxis
                      tick={{ fill: '#8a9aa8', fontSize: 10 }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#141a20',
                        border: '1px solid #243038',
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      name="Equity"
                      stroke="#3d9a8b"
                      fill="#3d9a8b33"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {result?.trades?.length > 0 && (
            <div className="panel">
              <h2>Trade log</h2>
              <table className="trades-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Side</th>
                    <th>Price</th>
                    <th>Signal</th>
                    <th>Regime</th>
                    <th>PnL</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((t, i) => (
                    <tr key={i}>
                      <td>{t.date}</td>
                      <td>{t.side}</td>
                      <td>${t.price?.toFixed(2)}</td>
                      <td>{t.signal}</td>
                      <td>{t.regime}</td>
                      <td>{t.pnl != null ? `$${t.pnl.toFixed(0)}` : '—'}</td>
                      <td>{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      <p className="disclaimer">
        {context?.disclaimer ||
          'Educational demo only. Not investment advice.'}
      </p>
    </div>
  );
}
