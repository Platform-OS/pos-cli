#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  ora = require('ora'),
  validate = require('./lib/validators'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/kit').logger,
  errors = require('./lib/errors'),
  version = require('./package.json').version;

const checkParams = params => {
  validate.existence({ argumentValue: params.token, argumentName: 'token', fail: program.help.bind(program) });
  validate.existence({ argumentValue: params.url, argumentName: 'url', fail: program.help.bind(program) });

  if (params.url.slice(-1) != '/') {
    params.url = params.url + '/';
  }
};

program
  .version(version)
  .option('--email <email>', 'developer email', process.env.MARKETPLACE_EMAIL)
  .option('--token <token>', 'authentication token', process.env.MARKETPLACE_TOKEN)
  .option('--url <url>', 'marketplace url', process.env.MARKETPLACE_URL);

program.parse(process.argv);

checkParams(program);

const gateway = new Gateway(program);

const formData = {
  'marketplace_builder[force_mode]': process.env.FORCE || 'false',
  'marketplace_builder[partial_deploy]': process.env.PARTIAL_DEPLOY || 'false',
  'marketplace_builder[zip_file]': fs.createReadStream('./tmp/marketplace-release.zip')
};

logger.Debug('FormData:', formData);

const getDeploymentStatus = id => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      gateway
        .getStatus(id, resolve, reject)
        .then(response => {
          if (response.status === 'ready_for_import') {
            setTimeout(getStatus, 1500);
          } else if (response.status === 'error') {
            reject();
            logger.Error(JSON.parse(response.error));
          } else {
            resolve(response);
          }
        })
        .catch(error => {
          logger.Error(error.response.body);
        });
    })();
  });
};

gateway.push(formData).then(
  body => {
    const responseBody = JSON.parse(body);
    const deploymentStatus = getDeploymentStatus(responseBody.id);

    ora.promise(deploymentStatus, { text: `Deploying to: ${program.url}`, spinner: 'bouncingBar' });
  },
  error => {
    errors.describe(error, logger.Error);
    logger.Error(error);
  }
);
