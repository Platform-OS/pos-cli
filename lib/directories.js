import fs from 'fs';

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
  toWatch: () => computed.ALLOWED.filter(fs.existsSync),
  currentApp: () => [app.APP, app.LEGACY_APP].filter(fs.existsSync)[0],
  available: () => computed.ALLOWED.filter(fs.existsSync)
};

export default Object.assign({}, app, internal, computed, methods);
