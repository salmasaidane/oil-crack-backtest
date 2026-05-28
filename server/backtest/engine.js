/**
 * Long/flat WTI backtest on SMA crossover (signal 1 = long, 0 = flat).
 */

function runBacktest(signals, params = {}) {
  const {
    slowPeriod = 50,
    initialCapital = 1_000_000,
    contractBbl = 1000,
    costBps = 2.5,
  } = params;

  const fee = (price) => (costBps / 10000) * contractBbl * price;
  const startIdx = signals.findIndex((s) => s.smaSlow != null);
  if (startIdx < 0) {
    return emptyResult(initialCapital, params);
  }

  let cash = initialCapital;
  let position = 0;
  let entryPrice = 0;
  const trades = [];
  const equity = [];

  for (let i = startIdx; i < signals.length; i++) {
    const cur = signals[i];
    const price = cur.wti;

    if (i > startIdx && position === 1) {
      const prev = signals[i - 1];
      cash += contractBbl * (price - prev.wti);
    }

    equity.push({
      date: cur.date,
      equity: cash,
      position,
      wti: price,
      signal: cur.signal,
      smaFast: cur.smaFast,
      smaSlow: cur.smaSlow,
    });

    const tag =
      params.strategy === 'crack'
        ? `Crack SMA ${params.fastPeriod}/${slowPeriod}`
        : `WTI SMA ${params.fastPeriod ?? 20}/${slowPeriod}`;

    if (position === 0 && cur.signal === 1) {
      position = 1;
      entryPrice = price;
      cash -= fee(price);
      trades.push({
        date: cur.date,
        side: 'BUY',
        price,
        reason: `${tag} bullish`,
      });
    } else if (position === 1 && cur.signal === 0) {
      const tradePnl = contractBbl * (price - entryPrice);
      cash -= fee(price);
      trades.push({
        date: cur.date,
        side: 'SELL',
        price,
        pnl: tradePnl,
        reason: `${tag} bearish`,
      });
      position = 0;
      entryPrice = 0;
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

  const closed = trades.filter((t) => t.side === 'SELL');
  const wins = closed.filter((t) => t.pnl > 0).length;

  return {
    summary: {
      strategy: params.strategyLabel || 'SMA crossover (long/flat)',
      initialCapital,
      finalEquity: Number(finalEq.toFixed(2)),
      totalReturnPct: Number((totalReturn * 100).toFixed(2)),
      sharpe: Number(sharpe.toFixed(2)),
      maxDrawdownPct: Number((maxDd * 100).toFixed(2)),
      trades: closed.length,
      winRatePct: closed.length
        ? Number(((wins / closed.length) * 100).toFixed(1))
        : 0,
    },
    equity,
    trades,
    params,
  };
}

function emptyResult(initialCapital, params) {
  return {
    summary: {
      strategy: 'WTI SMA crossover',
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

module.exports = { runBacktest };
