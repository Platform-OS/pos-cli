#!/usr/bin/env node

const program = require('commander'),
  spawn = require('child_process').spawn,
  command = require('../lib/command'),
  fetchAuthData = require('../lib/settings').fetchSettings;

const DEFAULT_CONCURRENCY = 3;

program
  .name('pos-cli sync')
  .arguments('[environment]', 'Name of environment. Example: staging')
  .option('--concurrency <number>', 'maximum concurrent connections to the server', DEFAULT_CONCURRENCY)
  .action((environment, params) => {
    const authData = fetchAuthData(environment, program);
    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      CONCURRENCY: process.env.CONCURRENCY || params.concurrency
    });

    spawn(command('pos-cli-watch'), [], { stdio: 'inherit', env });
  });

program.parse(process.argv);
