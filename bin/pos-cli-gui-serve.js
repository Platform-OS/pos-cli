#!/usr/bin/env node

const program = require('commander'),
  open = require('open');

const fetchAuthData = require('../lib/settings').fetchSettings,
  server = require('../lib/server'),
  logger = require('../lib/logger');

program
  .name('pos-cli gui serve')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('-p, --port <port>', 'use PORT', '3333')
  .option('-o, --open', 'when ready, open default browser with graphiql')
  .action(async (environment, params) => {
    const authData = fetchAuthData(environment, program);

    Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      MARKETPLACE_EMAIL: authData.email,
      PORT: params.port
    });

    try {
      await server.start(process.env);
      await open(`http://localhost:${params.port}/gui/graphql`);
    } catch (e) {
      logger.Error('✖ Failed.');
    }
  });

program.parse(process.argv);
