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

const STRATEGY_DEFAULTS = {
  spread: { strategy: 'spread', fastPeriod: 10, slowPeriod: 30 },
  crack: { strategy: 'crack', fastPeriod: 15, slowPeriod: 40 },
  wti: { strategy: 'wti', fastPeriod: 20, slowPeriod: 50 },
};

const HEADERS = {
  spread:
    'Distillate vs gasoline crack spread (EIA Gulf Coast spot). Long the spread when distillate margins outperform gasoline—relevant when middle-distillate tightness diverges from summer gasoline strength.',
  crack: '3-2-1 crack trend on WTI. Long crude when the composite refining margin trend is up.',
  wti: 'WTI trend following. Long 1,000 bbl when fast price SMA is above slow.',
};

function formatPct(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export default function App() {
  const [strategy, setStrategy] = useState('spread');
  const [params, setParams] = useState(STRATEGY_DEFAULTS.spread);
  const [meta, setMeta] = useState(null);
  const [signals, setSignals] = useState([]);
  const [context, setContext] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dataRes, ctxRes] = await Promise.all([
        fetch(`/api/data?strategy=${strategy}`),
        fetch(`/api/context?strategy=${strategy}`),
      ]);
      if (!dataRes.ok) throw new Error('Data API failed');
      const data = await dataRes.json();
      setMeta(data.meta);
      setSignals(data.signals || []);
      if (data.params) setParams((p) => ({ ...p, ...data.params }));
      if (ctxRes.ok) setContext(await ctxRes.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [strategy]);

  const runBacktest = useCallback(async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, strategy }),
      });
      if (!res.ok) throw new Error('Backtest failed');
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, [params, strategy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (signals.length > 0 && !running) {
      runBacktest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals.length, strategy]);

  const switchStrategy = (next) => {
    if (next === strategy) return;
    setStrategy(next);
    setParams(STRATEGY_DEFAULTS[next]);
    setSignals([]);
    setResult(null);
  };

  const isSpread = strategy === 'spread';
  const isCrack = strategy === 'crack';

  const chartData = useMemo(
    () =>
      signals.map((s) => ({
        date: s.date.slice(5),
        wti: s.wti,
        crack321: s.crack321,
        gasCrack: s.gasCrack,
        distCrack: s.distCrack,
        spread: s.spread,
        smaFast: s.smaFast,
        smaSlow: s.smaSlow,
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
        <h1>Oil products backtester</h1>
        <p>{HEADERS[strategy]}</p>
        <div className="strategy-toggle">
          <button
            type="button"
            className={isSpread ? 'active' : ''}
            onClick={() => switchStrategy('spread')}
          >
            Distillate vs gas
          </button>
          <button
            type="button"
            className={isCrack ? 'active' : ''}
            onClick={() => switchStrategy('crack')}
          >
            3-2-1 crack
          </button>
          <button
            type="button"
            className={strategy === 'wti' ? 'active' : ''}
            onClick={() => switchStrategy('wti')}
          >
            WTI trend
          </button>
        </div>
        <div className="badge-row">
          <span className="badge accent">{meta?.strategy}</span>
          <span className="badge accent">Source: {meta?.dataSource}</span>
          {meta?.productsNote && (
            <span className="badge" title={meta.productsNote}>
              EIA products
            </span>
          )}
          <span className="badge">{meta?.from} → {meta?.to}</span>
        </div>
      </header>

      <div className="grid grid-2">
        <aside className="panel">
          <h2>Strategy parameters</h2>
          {[
            { key: 'fastPeriod', label: 'Fast SMA (days)', min: 5, max: 40, step: 1 },
            { key: 'slowPeriod', label: 'Slow SMA (days)', min: 15, max: 120, step: 5 },
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
              <h2 style={{ marginTop: '1.25rem' }}>Thesis &amp; data</h2>
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
                <div className="value">${summary.finalEquity.toLocaleString()}</div>
              </div>
              {summary.spreadRangeBbl && (
                <div className="metric">
                  <div className="label">Spread range</div>
                  <div className="value" style={{ fontSize: '0.85rem' }}>
                    {summary.spreadRangeBbl}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="panel">
            <h2>
              {isSpread
                ? 'Cracks & distillate−gasoline spread ($/bbl)'
                : isCrack
                  ? '3-2-1 crack & SMAs ($/bbl)'
                  : 'WTI & SMAs ($/bbl)'}
            </h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid stroke="#243038" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: '#8a9aa8', fontSize: 10 }} />
                  <YAxis yAxisId="main" tick={{ fill: '#8a9aa8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#141a20',
                      border: '1px solid #243038',
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  {isSpread && (
                    <>
                      <Line
                        yAxisId="main"
                        type="monotone"
                        dataKey="distCrack"
                        name="Distillate crack"
                        stroke="#c9a227"
                        dot={false}
                        strokeWidth={1.3}
                      />
                      <Line
                        yAxisId="main"
                        type="monotone"
                        dataKey="gasCrack"
                        name="Gasoline crack"
                        stroke="#3d9a8b"
                        dot={false}
                        strokeWidth={1.3}
                      />
                      <Line
                        yAxisId="main"
                        type="monotone"
                        dataKey="spread"
                        name="Spread (dist−gas)"
                        stroke="#e8edf2"
                        dot={false}
                        strokeWidth={1.8}
                      />
                    </>
                  )}
                  {isCrack && (
                    <Line
                      yAxisId="main"
                      type="monotone"
                      dataKey="crack321"
                      name="Crack 3-2-1"
                      stroke="#c9a227"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  )}
                  {strategy === 'wti' && (
                    <Line
                      yAxisId="main"
                      type="monotone"
                      dataKey="wti"
                      name="WTI"
                      stroke="#3d9a8b"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  )}
                  <Line
                    yAxisId="main"
                    type="monotone"
                    dataKey="smaFast"
                    name={isSpread ? 'Fast SMA (spread)' : 'Fast SMA'}
                    stroke="#4caf82"
                    dot={false}
                    strokeWidth={1.1}
                    strokeDasharray={isSpread ? '4 4' : undefined}
                  />
                  <Line
                    yAxisId="main"
                    type="monotone"
                    dataKey="smaSlow"
                    name={isSpread ? 'Slow SMA (spread)' : 'Slow SMA'}
                    stroke="#8a9aa8"
                    dot={false}
                    strokeWidth={1.1}
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
                    <th>Level</th>
                    <th>PnL</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((t, i) => (
                    <tr key={i}>
                      <td>{t.date}</td>
                      <td>{t.side}</td>
                      <td>
                        {isSpread ? `${t.price?.toFixed(2)} $/bbl` : `$${t.price?.toFixed(2)}`}
                      </td>
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
        {context?.disclaimer || 'Educational demo only. Not investment advice.'}
      </p>
    </div>
  );
}
