const fs = require('fs'),
  { performance } = require('perf_hooks');

const validate = require('../lib/validators'),
  logger = require('../lib/logger'),
  report = require('../lib/logger/report'),
  Gateway = require('../lib/proxy'),
  duration = require('../lib/duration'),
  ServerError = require('../lib/ServerError');
let gateway;

const getDeploymentStatus = ({ id }) => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      gateway
        .getStatus(id)
        .then(response => {
          if (response && response.status === 'ready_for_import') {
            setTimeout(getStatus, 1500);
          } else if (response && response.status === 'error') {
            const body = response.error;
            let message = body.error;
            if (body.details.file_path) {
              message += `\n${body.details.file_path}`;
            }
            return logger.Error(message, { exit: true });
          } else {
            resolve();
          }
        })
        .catch(error => {
          report('getStatus', {
            extras: [
              { key: 'status', value: 'Error' },
              { key: 'trace', value: error }
            ]
          });
          reject(false);
        });
    })();
  });
};

const push = async env => {
  const program = {
    email: env.MARKETPLACE_EMAIL,
    token: env.MARKETPLACE_TOKEN,
    url: env.MARKETPLACE_URL
  };
  const t0 = performance.now();
  const formData = {
    'marketplace_builder[partial_deploy]': env.PARTIAL_DEPLOY || 'false',
    'marketplace_builder[zip_file]': fs.createReadStream('./tmp/release.zip')
  };

  gateway = new Gateway(program);
  return gateway
    .push(formData)
    .then(getDeploymentStatus)
    .then(() => {
      logger.Debug('Release deployed');
      const t1 = performance.now();
      return duration(t0, t1);
    })
    .catch(() => false);
};

module.exports = {
  push: push
};
