const crypto = require('crypto');
const { execSync } = require('child_process');

const Sentry = require('@sentry/node');

const env = extras => {
  if (process.env.CI === 'true') {
    return 'CI';
  }

  const object = extras.filter(o => o.key === 'url')[0];
  if (object && object.value && object.value.indexOf('.staging.') > 0) {
    return 'staging';
  }

  return 'production';
}

const getStdout = cmd => {
  const stdout = execSync(cmd);

  return stdout.toString().trim();
};

const sha = str =>
  crypto
    .createHash('sha1')
    .update(JSON.stringify(str))
    .digest('hex');

Sentry.configureScope(scope => {
  const os = process.platform;
  const id = sha({
    platform: os === 'win32' ? getStdout('systeminfo | findstr /B /C:"OS Name" /C:"OS Version"') : getStdout('uname -a'),
    node: process.version,
    shell: process.env.shell
  });

  scope.setExtra('platform', os);
  scope.setExtra('nodeVersion', process.version);
  scope.setExtra('shell', process.env.SHELL);

  scope.setUser({ id });
});

const setExtras = o => {
  if (o && o.extras) {
    Sentry.configureScope(scope => {
      for (let extra in o.extras) {
        scope.setExtra(o.extras[extra].key, o.extras[extra].value);
      }
    });
  }
};

module.exports = (message, opts) => {
  Sentry.init({
    dsn: 'https://36aa7321636447dc9e629e0ae9ab9ad0@sentry.io/1491332',
    release: require('../../package.json').version,
    maxBreadcrumbs: 10,
    captureUnhandledRejections: false,
    ignoreErrors: [
      'NodeBackend.eventFromException'
    ],
    environment: env(opts.extras)
  });

  setExtras(opts);

  Sentry.captureMessage(message);
};
