const fs = require('fs');

const app = {
  APP: 'app',
  LEGACY_APP: 'marketplace_builder',
  MODULES: 'modules'
};

const internal = {
  TMP: '.tmp'
};

const computed = {
  ALLOWED: [app.APP, app.LEGACY_APP, app.MODULES]
};

const methods = {
  toWatch: () => computed.ALLOWED.filter(path => path && fs.existsSync(path)),
  currentApp: () => [app.APP, app.LEGACY_APP].filter(path => path && fs.existsSync(path))[0],
  available: () => computed.ALLOWED.filter(path => path && fs.existsSync(path))
};

module.exports = Object.assign({}, app, internal, computed, methods);
