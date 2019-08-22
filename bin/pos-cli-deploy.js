#!/usr/bin/env node
const program = require('commander');

const fetchAuthData = require('../lib/settings').fetchSettings;
const logger = require('../lib/logger');
const deployStrategy = require('../lib/deploy/strategy');
const audit = require('../lib/audit');

const runAudit = async () => {
  if (process.env.CI == 'true') {
    return;
  }

  await audit.run();
};

program
  .name('pos-cli deploy')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('-f --force', 'deprecated')
  .option('-d --direct-assets-upload', 'Uploads assets straight to S3 servers. [experimental]')
  .option('-p --partial-deploy', 'Partial deployment, does not remove data from directories missing from the build')
  .action(async (environment, params) => {
    if (params.force) logger.Warn('-f flag is deprecated and does not do anything.');

    const strategy = params.directAssetsUpload ? 'directAssetsUpload' : 'default';
    const authData = fetchAuthData(environment, program);
    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      MARKETPLACE_ENV: environment,
      CI: process.env.CI === 'true',
      // TODO: Get rid off global system env, make it normal argument to function.
      PARTIAL_DEPLOY: params.partialDeploy,
      DIRECT_ASSETS_UPLOAD: params.directAssetsUpload
    });

    await runAudit();
    deployStrategy.run({ strategy, opts: { env, authData, params } });
  });

program.parse(process.argv);
