#!/usr/bin/env node

const program = require('commander'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  spawn = require('child_process').spawn,
  ora = require('ora'),
  sh = require('@platform-os/shelljs'),
  command = require('../lib/command'),
  logger = require('../lib/logger'),
  Gateway = require('../lib/proxy'),
  assets = require('../lib/assets'),
  version = require('../package.json').version;

const uploadArchive = (env, usingDeploymentService) => {
  const options = usingDeploymentService ? ['--without-assets'] : [];
  return new Promise((resolve, reject) => {
    const archive = spawn(command('pos-cli-archive'), options, {
      stdio: 'inherit'
    });

    archive.on('close', code => {
      if (code === 1) {
        logger.Error('Deploy failed.');
        reject();
      }

      const push = spawn(command('pos-cli-push'), [], {
        stdio: 'inherit',
        env: env
      });

      push.on('close', exitCode => {
        if (exitCode === 1) {
          logger.Error('Deploy failed.');
          reject(false);
        } else if (exitCode === 0) {
          resolve(true);
        }
      });
    });
  });
};

const deploy = async (env, authData, params) => {
  await uploadArchive(env, params.directAssetsUpload);
  if (params.directAssetsUpload) {
    const spinner = ora({ text: 'Uploading assets', stream: process.stdout, spinner: 'bouncingBar' }).start();

    await assets.deployAssets(new Gateway(authData));

    spinner.stopAndPersist().succeed('Assets uploaded');
  }
};

const runAudit = () => {
  return new Promise(resolve => {
    logger.Info('Starting audit...');

    sh.exec('FORCE_COLOR=true pos-cli audit', resolve); // Enable colors when running script via `npm`
  });
};

program
  .version(version)
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('-f --force', 'force update. Removes instance-admin lock')
  .option('-d --direct-assets-upload', 'Uploads assets straight to S3 servers. It should be faster. [experimental]')
  .option('-p --partial-deploy', 'Partial deployment, does not remove data from directories missing from the build')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action(async (environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;

    if (params.force) process.env.FORCE = params.force;
    if (params.partialDeploy) process.env.PARTIAL_DEPLOY = params.partialDeploy;

    const authData = fetchAuthData(environment, program);

    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      MARKETPLACE_ENV: environment
    });

    // prettier-ignore
    Promise.all([
      process.env.CI ? Promise.resolve() : runAudit(),
      deploy(env, authData, params)
    ])
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });

program.parse(process.argv);
