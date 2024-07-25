#!/usr/bin/env node

const { program } = require('commander'),
  watch = require('../lib/watch');

// importing ESM modules in CommonJS project
let open;
const initializeEsmModules = async () => {
  if(!open) {
    await import('open').then(imported => open = imported.default);
  }

  return true;
}

const fetchAuthData = require('../lib/settings').fetchSettings;

const DEFAULT_CONCURRENCY = 3;

program
  .name('pos-cli sync')
  .argument('[environment]', 'Name of environment. Example: staging')
  .option('-c, --concurrency <number>', 'Maximum concurrent connections to the server', DEFAULT_CONCURRENCY)
  .option('-d, --direct-assets-upload', 'deprecated, this is the default strategy', true)
  .option('-o, --open', 'When ready, open default browser with instance')
  .option('-l, --livereload', 'Use livereload')
  .action(async (environment, params) => {
    const authData = fetchAuthData(environment);
    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      CONCURRENCY: process.env.CONCURRENCY || params.concurrency
    });

    watch.start(env, params.directAssetsUpload, params.livereload);

    if (params.open) {
      await initializeEsmModules();
      await open(`${authData.url}`);
    }
  });

program.parse(process.argv);
