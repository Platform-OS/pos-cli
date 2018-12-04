#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  { performance } = require('perf_hooks'),
  ora = require('ora'),
  validate = require('./lib/validators'),
  Gateway = require('./lib/proxy'),
  ServerError = require('./lib/ServerError'),
  logger = require('./lib/logger'),
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

const formatMMSS = s => (s - (s %= 60)) / 60 + (9 < s ? ':' : ':0') + s;
const duration = (t0, t1) => {
  const duration = Math.round((t1 - t0) / 1000);
  return formatMMSS(duration);
};

const t0 = performance.now();

const spinner = ora({ text: `Deploying to: ${program.url}`, stream: process.stdout, spinner: 'bouncingBar' }).start();

const gateway = new Gateway(program);

const formData = {
  'marketplace_builder[force_mode]': process.env.FORCE || 'false',
  'marketplace_builder[partial_deploy]': process.env.PARTIAL_DEPLOY || 'false',
  'marketplace_builder[zip_file]': fs.createReadStream('./tmp/marketplace-release.zip')
};

const getDeploymentStatus = id => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      gateway.getStatus(id).then(response => {
        if (response.status === 'ready_for_import') {
          setTimeout(getStatus, 1500);
        } else if (response.status === 'error') {
          const t1 = performance.now();
          ServerError.deploy(JSON.parse(response.error));
          spinner.fail(`Deploy failed after ${duration(t0, t1)}`);
          process.exit(1);
        } else {
          resolve(response);
        }
      });
    })();
  });
};

gateway
  .push(formData)
  .then(response => {
    getDeploymentStatus(response.id).then(() => {
      const t1 = performance.now();
      spinner.stopAndPersist().succeed(`Deploy succeeded after ${duration(t0, t1)}`);
    });
  })
  .catch(() => {
    spinner.stopAndPersist().fail('Deploy failed');
    process.exit(1);
  });
