const app = {
  APP: 'app',
  LEGACY_APP: 'marketplace_builder',
  MODULES: 'modules',
};

const internal = {
  TMP: '.tmp'
};

const computed = {
  ALLOWED: [app.APP, app.LEGACY_APP, app.MODULES]
};

module.exports = Object.assign({}, app, internal, computed);
