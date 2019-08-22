const fs = require('fs'),
  { performance } = require('perf_hooks');
const ora = require('ora');

const validate = require('../lib/validators'),
  logger = require('../lib/logger'),
  report = require('../lib/logger/report'),
  Gateway = require('../lib/proxy'),
  ServerError = require('../lib/ServerError');
let gateway;

const getDeploymentStatus = ({ id }) => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      gateway.getStatus(id).then(response => {
        if (response && response.status === 'ready_for_import') {
          setTimeout(getStatus, 1500);
        } else if (response && response.status === 'error') {
          const body = response.error;
          return logger.Error(`${body.error}\n${body.details.file_path}`, { exit: true });
        } else {
          resolve();
        }
      }).catch(error => {
        report('getStatus', { extras: [{ key: 'status', value: 'Error' }, { key: 'trace', value: error }] });
        reject(false);
      });
    })();
  });
};

const push = async(env) => {
  const program = {
    email: env.MARKETPLACE_EMAIL,
    token: env.MARKETPLACE_TOKEN,
    url: env.MARKETPLACE_URL
  };
  const formatMMSS = s => (s - (s %= 60)) / 60 + (9 < s ? ':' : ':0') + s;
  const duration = (t0, t1) => {
    const duration = Math.round((t1 - t0) / 1000);
    return formatMMSS(duration);
  };
  const t0 = performance.now();
  const DIRECT = env.DIRECT_ASSETS_UPLOAD === 'true';
  const msg = program => (DIRECT ? `Deploying resources to: ${program.url}` : `Deploying to: ${program.url}`);
  const spinner = ora({ text: msg(program), stream: process.stdout, spinner: 'bouncingBar' }).start();
  const formData = {
    'marketplace_builder[partial_deploy]': env.PARTIAL_DEPLOY || 'false',
    'marketplace_builder[zip_file]': fs.createReadStream('./tmp/release.zip')
  };

  gateway = new Gateway(program);
  return gateway
    .push(formData)
    .then(getDeploymentStatus)
    .then(() => {
      const t1 = performance.now();
      if (!DIRECT) {
        spinner.succeed(`Deploy succeeded after ${duration(t0, t1)}`);
      }
      return true;
    })
    .catch(() => false);
};

module.exports = {
  push: push
};
