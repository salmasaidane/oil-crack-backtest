/**
 * Simple long/flat WTI futures-style backtest on augmented crack + war signals.
 */

function runBacktest(signals, params = {}) {
  const {
    entryZ = 0.75,
    exitZ = 0.15,
    warMaxGpr = 0.85,
    minConfidence = 0.35,
    initialCapital = 1_000_000,
    contractBbl = 1000,
    costBps = 2.5,
  } = params;

  let cash = initialCapital;
  let position = 0;
  let entryPrice = 0;
  const trades = [];
  const equity = [];

  for (let i = 1; i < signals.length; i++) {
    const prev = signals[i - 1];
    const cur = signals[i];
    const price = cur.wti;
    const ret = (price - prev.wti) / prev.wti;

    if (position !== 0) {
      const pnl = position * contractBbl * (price - entryPrice);
      cash += position * contractBbl * (price - prev.wti);
    }

    const mark = cash + position * contractBbl * price;
    equity.push({
      date: cur.date,
      equity: mark,
      position,
      wti: price,
      signal: cur.signal,
      gpr: cur.gpr,
    });

    const warBlock = cur.gpr > warMaxGpr && cur.signal > 0;
    const canTrade = cur.confidence >= minConfidence && !warBlock;

    if (position === 0 && canTrade && cur.signal > entryZ) {
      const cost = (costBps / 10000) * contractBbl * price;
      position = 1;
      entryPrice = price;
      cash -= cost;
      trades.push({
        date: cur.date,
        side: 'BUY',
        price,
        signal: cur.signal,
        regime: cur.regime,
        reason: 'augmented crack long',
      });
    } else if (position === 1 && (cur.signal < exitZ || warBlock)) {
      const cost = (costBps / 10000) * contractBbl * price;
      cash -= cost;
      const tradePnl = contractBbl * (price - entryPrice);
      trades.push({
        date: cur.date,
        side: 'SELL',
        price,
        signal: cur.signal,
        regime: cur.regime,
        pnl: tradePnl,
        reason: warBlock ? 'war risk de-risk' : 'signal mean reversion',
      });
      position = 0;
      entryPrice = 0;
    }

    void ret;
  }

  const finalEq = equity[equity.length - 1]?.equity ?? initialCapital;
  const totalReturn = (finalEq - initialCapital) / initialCapital;
  const dailyReturns = [];
  for (let i = 1; i < equity.length; i++) {
    const r = (equity[i].equity - equity[i - 1].equity) / equity[i - 1].equity;
    dailyReturns.push(r);
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

  const wins = trades.filter((t) => t.pnl > 0).length;
  const closed = trades.filter((t) => t.side === 'SELL').length;

  return {
    summary: {
      initialCapital,
      finalEquity: Number(finalEq.toFixed(2)),
      totalReturnPct: Number((totalReturn * 100).toFixed(2)),
      sharpe: Number(sharpe.toFixed(2)),
      maxDrawdownPct: Number((maxDd * 100).toFixed(2)),
      trades: closed,
      winRatePct: closed ? Number(((wins / closed) * 100).toFixed(1)) : 0,
    },
    equity,
    trades,
    params,
  };
}

module.exports = { runBacktest };
