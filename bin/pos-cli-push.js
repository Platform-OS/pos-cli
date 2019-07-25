#!/usr/bin/env node

const fs = require('fs'),
  { performance } = require('perf_hooks');

const program = require('commander'),
  ora = require('ora');

const validate = require('../lib/validators'),
  Gateway = require('../lib/proxy'),
  ServerError = require('../lib/ServerError'),
  logger = require('../lib/logger');

const checkParams = params => {
  validate.existence({ argumentValue: params.token, argumentName: 'token', fail: program.help.bind(program) });
  validate.existence({ argumentValue: params.url, argumentName: 'url', fail: program.help.bind(program) });
  validate.existence({ argumentValue: params.email, argumentName: 'email', fail: program.help.bind(program) });

  if (params.url.slice(-1) != '/') {
    params.url = params.url + '/';
  }
};

program
  .option('--email <email>', 'developer email', process.env.MARKETPLACE_EMAIL)
  .option('--token <token>', 'authentication token', process.env.MARKETPLACE_TOKEN)
  .option('--url <url>', 'application url', process.env.MARKETPLACE_URL);

program.parse(process.argv);

checkParams(program);

const formatMMSS = s => (s - (s %= 60)) / 60 + (9 < s ? ':' : ':0') + s;
const duration = (t0, t1) => {
  const duration = Math.round((t1 - t0) / 1000);
  return formatMMSS(duration);
};

const t0 = performance.now();

const DIRECT = process.env.DIRECT_ASSETS_UPLOAD === 'true';

const msg = program => (DIRECT ? `Deploying resources to: ${program.url}` : `Deploying to: ${program.url}`);

const spinner = ora({ text: msg(program), stream: process.stdout, spinner: 'bouncingBar' }).start();

const gateway = new Gateway(program);

const formData = {
  'marketplace_builder[partial_deploy]': process.env.PARTIAL_DEPLOY || 'false',
  'marketplace_builder[zip_file]': fs.createReadStream('./tmp/release.zip')
};

const getDeploymentStatus = ({ id }) => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      gateway.getStatus(id).then(response => {
        if (response.status === 'ready_for_import') {
          setTimeout(getStatus, 1500);
        } else if (response.status === 'error') {
          ServerError.deploy(JSON.parse(response.error));
          reject();
        } else {
          resolve();
        }
      });
    })();
  });
};

gateway
  .push(formData)
  .then(getDeploymentStatus)
  .then(() => {
    const t1 = performance.now();
    if (!DIRECT) {
      spinner.succeed(`Deploy succeeded after ${duration(t0, t1)}`);
    }
  })
  .catch(error => {
    const t1 = performance.now();
    logger.Error(error);
    spinner.fail(`Deploy failed after ${duration(t0, t1)}`);
    process.exit(1);
  });
