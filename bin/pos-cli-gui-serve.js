#!/usr/bin/env node

const program = require('commander'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  server = require('../lib/server');
  logger = require('../lib/logger');

program
  .name('pos-cli gui serve')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('-p --port <port>', 'use PORT', '3333')
  .action(async (environment, params) => {
    const authData = fetchAuthData(environment, program);

    Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      MARKETPLACE_EMAIL: authData.email,
      PORT: params.port
    });

    try{
      await server.start(process.env);
    } catch(e) {
      logger.Error('✖ Failed.');
    };
  });

program.parse(process.argv);
