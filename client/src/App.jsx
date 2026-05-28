import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const DEFAULT_PARAMS = { fastPeriod: 20, slowPeriod: 50 };

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
    setResult(null);
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
    if (signals.length > 0 && !running) {
      runBacktest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals.length]);

  const chartData = useMemo(
    () =>
      signals.map((s) => ({
        date: s.date.slice(5),
        wti: s.wti,
        smaFast: s.smaFast,
        smaSlow: s.smaSlow,
        signal: s.signal,
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
        <button
          className="primary"
          onClick={loadData}
          style={{ width: 'auto', marginTop: '1rem' }}
        >
          Retry
        </button>
      </div>
    );

  const summary = result?.summary;

  return (
    <div className="app">
      <header>
        <h1>WTI Oil Trend Backtester</h1>
        <p>
          Simple moving-average crossover on WTI: long when the fast average is above
          the slow average, flat otherwise. One futures lot (1,000 bbl) per signal.
        </p>
        <div className="badge-row">
          <span className="badge accent">
            {meta?.strategy || 'SMA crossover'}
          </span>
          <span className="badge accent">Source: {meta?.dataSource}</span>
          <span className="badge">{meta?.from} → {meta?.to}</span>
        </div>
      </header>

      <div className="grid grid-2">
        <aside className="panel">
          <h2>Strategy parameters</h2>
          {[
            { key: 'fastPeriod', label: 'Fast SMA (days)', min: 5, max: 40, step: 1 },
            { key: 'slowPeriod', label: 'Slow SMA (days)', min: 20, max: 120, step: 5 },
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
                  setParams((p) => ({ ...p, [key]: parseInt(e.target.value, 10) }))
                }
              />
            </div>
          ))}
          <button className="primary" onClick={runBacktest} disabled={running}>
            {running ? 'Running…' : 'Run backtest'}
          </button>

          {context && (
            <>
              <h2 style={{ marginTop: '1.25rem' }}>How it works</h2>
              <ul className="context-list">
                {context.narrative.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </>
          )}

          {summary?.trades === 0 && (
            <p className="context-list" style={{ color: 'var(--warn)', marginTop: '1rem' }}>
              No trades yet — widen the SMA gap or refresh data.
            </p>
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
                <div className="value negative">
                  {formatPct(summary.maxDrawdownPct)}
                </div>
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
            <h2>WTI price &amp; SMAs ($/bbl)</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
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
                    dataKey="wti"
                    name="WTI"
                    stroke="#3d9a8b"
                    dot={false}
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="smaFast"
                    name="Fast SMA"
                    stroke="#4caf82"
                    dot={false}
                    strokeWidth={1.2}
                  />
                  <Line
                    type="monotone"
                    dataKey="smaSlow"
                    name="Slow SMA"
                    stroke="#c9a227"
                    dot={false}
                    strokeWidth={1.2}
                  />
                </ComposedChart>
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
                    <YAxis tick={{ fill: '#8a9aa8', fontSize: 10 }} domain={['auto', 'auto']} />
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
