/**
 * PnL for long distillate crack / short gasoline crack (1,000 bbl per leg).
 * Daily mark: notional × Δ(spread), spread = distillate crack − gasoline crack.
 */

function runSpreadBacktest(signals, params = {}) {
  const {
    slowPeriod = 30,
    initialCapital = 1_000_000,
    contractBbl = 1000,
    costBps = 2.5,
  } = params;

  const startIdx = signals.findIndex((s) => s.smaSlow != null);
  if (startIdx < 0) {
    return emptyResult(initialCapital, params);
  }

  const fee = (spreadLevel) =>
    (costBps / 10000) * contractBbl * Math.max(20, Math.abs(spreadLevel));

  let cash = initialCapital;
  let position = 0;
  let entrySpread = 0;
  const trades = [];
  const equity = [];

  for (let i = startIdx; i < signals.length; i++) {
    const cur = signals[i];
    const spread = cur.spread;

    if (i > startIdx && position === 1) {
      const prev = signals[i - 1];
      cash += contractBbl * (spread - prev.spread);
    }

    equity.push({
      date: cur.date,
      equity: cash,
      position,
      spread,
      gasCrack: cur.gasCrack,
      distCrack: cur.distCrack,
      signal: cur.signal,
    });

    const tag = `Dist−Gas ${params.fastPeriod}/${slowPeriod}`;

    if (position === 0 && cur.signal === 1) {
      position = 1;
      entrySpread = spread;
      cash -= fee(spread);
      trades.push({
        date: cur.date,
        side: 'LONG SPREAD',
        price: spread,
        reason: `${tag}: distillate crack outperforming gasoline`,
      });
    } else if (position === 1 && cur.signal === 0) {
      const tradePnl = contractBbl * (spread - entrySpread);
      cash -= fee(spread);
      trades.push({
        date: cur.date,
        side: 'EXIT SPREAD',
        price: spread,
        pnl: tradePnl,
        reason: `${tag}: spread trend reversed`,
      });
      position = 0;
      entrySpread = 0;
    }
  }

  const finalEq = equity[equity.length - 1]?.equity ?? initialCapital;
  const totalReturn = (finalEq - initialCapital) / initialCapital;

  const dailyReturns = [];
  for (let i = 1; i < equity.length; i++) {
    dailyReturns.push(
      (equity[i].equity - equity[i - 1].equity) / equity[i - 1].equity
    );
  }
  const meanR =
    dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const stdR =
    Math.sqrt(
      dailyReturns.reduce((a, b) => a + (b - meanR) ** 2, 0) /
        (dailyReturns.length || 1)
    ) || 1e-9;
  const sharpe = (meanR / stdR) * Math.sqrt(252);

  let peak = initialCapital;
  let maxDd = 0;
  for (const e of equity) {
    peak = Math.max(peak, e.equity);
    maxDd = Math.min(maxDd, (e.equity - peak) / peak);
  }

  const closed = trades.filter((t) => t.side === 'EXIT SPREAD');
  const wins = closed.filter((t) => t.pnl > 0).length;

  const spreads = signals.map((s) => s.spread).filter((x) => x != null);
  const maxSpread = spreads.length ? Math.max(...spreads) : 0;
  const minSpread = spreads.length ? Math.min(...spreads) : 0;

  return {
    summary: {
      strategy:
        params.strategyLabel ||
        'Long distillate crack / short gasoline crack (spread momentum)',
      initialCapital,
      finalEquity: Number(finalEq.toFixed(2)),
      totalReturnPct: Number((totalReturn * 100).toFixed(2)),
      sharpe: Number(sharpe.toFixed(2)),
      maxDrawdownPct: Number((maxDd * 100).toFixed(2)),
      trades: closed.length,
      winRatePct: closed.length
        ? Number(((wins / closed.length) * 100).toFixed(1))
        : 0,
      spreadRangeBbl: `${minSpread.toFixed(1)} to ${maxSpread.toFixed(1)} $/bbl`,
    },
    equity,
    trades,
    params,
  };
}

function emptyResult(initialCapital, params) {
  return {
    summary: {
      strategy: 'Distillate–gasoline spread',
      initialCapital,
      finalEquity: initialCapital,
      totalReturnPct: 0,
      sharpe: 0,
      maxDrawdownPct: 0,
      trades: 0,
      winRatePct: 0,
    },
    equity: [],
    trades: [],
    params,
  };
}

module.exports = { runSpreadBacktest };
