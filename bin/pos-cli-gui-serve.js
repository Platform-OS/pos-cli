#!/usr/bin/env node

const program = require('commander'),
  spawn = require('child_process').spawn,
  fetchAuthData = require('../lib/settings').fetchSettings,
  command = require('../lib/command'),
  logger = require('../lib/logger');

program
  .name('pos-cli gui serve')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .option('-p --port <port>', 'use PORT', '3333')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment, program);

    Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      MARKETPLACE_EMAIL: authData.email,
      PORT: params.port
    });

    const server = spawn(command('pos-cli-server'), [], { stdio: 'inherit' });

    server.on('close', code => {
      if (code === 1) {
        logger.Error('✖ Failed.');
      }
    });
  });

program.parse(process.argv);
