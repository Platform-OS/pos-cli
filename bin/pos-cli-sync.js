#!/usr/bin/env node

const program = require('commander'),
  deployStrategy = require('../lib/deploy/strategy'),
  watch = require('../lib/watch'),
  fetchAuthData = require('../lib/settings').fetchSettings;

const DEFAULT_CONCURRENCY = 3;

program
  .name('pos-cli sync')
  .arguments('[environment]', 'Name of environment. Example: staging')
  .option('--concurrency <number>', 'maximum concurrent connections to the server', DEFAULT_CONCURRENCY)
  .option('-d --direct-assets-upload', 'Uploads assets straight to S3 servers. [experimental]')
  .action((environment, params) => {
    const authData = fetchAuthData(environment, program);
    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      CONCURRENCY: process.env.CONCURRENCY || params.concurrency
    });

    const strategy = 'default';
    deployStrategy.run({ strategy, opts: { env, authData, params } }).then(() => {
      watch.start(env, params.directAssetsUpload);
    });
  });

program.parse(process.argv);
