#!/usr/bin/env node

const program = require('commander'),
  watch = require('../lib/watch'),
  open = require('open'),
  livereload = require('livereload');

const fetchAuthData = require('../lib/settings').fetchSettings;

const DEFAULT_CONCURRENCY = 3;

program
  .name('pos-cli sync')
  .arguments('[environment]', 'Name of environment. Example: staging')
  .option('--concurrency <number>', 'maximum concurrent connections to the server', DEFAULT_CONCURRENCY)
  .option('-d, --direct-assets-upload', 'Uploads assets straight to S3 servers. [experimental]')
  .option('-o, --open', 'when ready, open default browser with instance')
  .option('-l, --livereload', 'Use livereload')
  .action(async (environment, params) => {
    const authData = fetchAuthData(environment, program);
    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      CONCURRENCY: process.env.CONCURRENCY || params.concurrency
    });

    watch.start(env, params.directAssetsUpload, params.livereload);

    if (params.open) {
      await open(`${authData.url}`);
    }
  });

program.parse(process.argv);
