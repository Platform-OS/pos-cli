#!/usr/bin/env node
const swagger = require('../lib/swagger-client');

const program = require('commander'),
  watch = require('../lib/watch'),
  open = require('open');

const fetchAuthData = require('../lib/settings').fetchSettings,
  server = require('../lib/server'),
  logger = require('../lib/logger');

const DEFAULT_CONCURRENCY = 3;

program
  .name('pos-cli gui serve')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('-p, --port <port>', 'use PORT', '3333')
  .option('-o, --open', 'when ready, open default browser with graphiql')
  .option('-s, --sync', 'Sync files')
  .action(async (environment, params) => {
    const authData = fetchAuthData(environment, program);

    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      PORT: params.port,
      CONCURRENCY: process.env.CONCURRENCY || DEFAULT_CONCURRENCY
    });

    try {
      const client = await swagger.SwaggerProxy.client(environment);
      server.start(env, client);
      if (params.open) {
        await open(`http://localhost:${params.port}`);
      }

      if (params.sync){
        watch.start(env, true, false);
      }
    } catch (e) {
      console.log(e);
      logger.Error('✖ Failed.');
    }
  });

program.parse(process.argv);
