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
  toWatch: () => computed.ALLOWED.filter(fs.existsSync),
  currentApp: () => [app.APP, app.LEGACY_APP].filter(fs.existsSync)[0],
  available: () => computed.ALLOWED.filter(fs.existsSync)
};

// Filter for {app,modules,marketplace_builder}/ top level directories.
// This is necessary because tiny-glob doesn't return files from all subdirectories: https://github.com/terkelg/tiny-glob/issues/28
const filterAppModules = files => files.filter(file => file.match(new RegExp(`^(${Object.values(app).join('|')})/`)));

module.exports = { app, internal, computed, methods, filterAppModules };
