const wti = require('./wtiSmaSignals');
const crack = require('./crackSmaSignals');
const spread = require('./distillateGasSpread');

const STRATEGIES = {
  spread: {
    id: 'spread',
    label: 'Distillate vs gasoline',
    buildSignals: spread.buildSignals,
    defaults: { fastPeriod: 10, slowPeriod: 30 },
    summary: 'Long distillate crack / short gasoline crack (spread momentum)',
    engine: 'spread',
  },
  crack: {
    id: 'crack',
    label: '3-2-1 crack trend',
    buildSignals: crack.buildSignals,
    defaults: { fastPeriod: 15, slowPeriod: 40 },
    summary: '3-2-1 crack SMA crossover (long/flat WTI)',
    engine: 'wti',
  },
  wti: {
    id: 'wti',
    label: 'WTI trend',
    buildSignals: wti.buildSignals,
    defaults: { fastPeriod: 20, slowPeriod: 50 },
    summary: 'WTI SMA crossover (long/flat)',
    engine: 'wti',
  },
};

function getStrategy(key) {
  if (STRATEGIES[key]) return STRATEGIES[key];
  return STRATEGIES.spread;
}

module.exports = { STRATEGIES, getStrategy };
