const wti = require('./wtiSmaSignals');
const crack = require('./crackSmaSignals');

const STRATEGIES = {
  wti: {
    id: 'wti',
    label: 'WTI trend',
    buildSignals: wti.buildSignals,
    defaults: { fastPeriod: 20, slowPeriod: 50 },
    summary: 'WTI SMA crossover (long/flat)',
  },
  crack: {
    id: 'crack',
    label: 'Crack trend',
    buildSignals: crack.buildSignals,
    defaults: { fastPeriod: 15, slowPeriod: 40 },
    summary: '3-2-1 crack SMA crossover (long/flat WTI)',
  },
};

function getStrategy(key) {
  return STRATEGIES[key] || STRATEGIES.crack;
}

module.exports = { STRATEGIES, getStrategy };
