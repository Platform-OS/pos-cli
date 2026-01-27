#!/usr/bin/env node
import { SwaggerProxy } from '../lib/swagger-client.js';

import { program } from 'commander';
import { start as watch } from '../lib/watch.js';

import { fetchSettings } from '../lib/settings.js';
import { start as server } from '../lib/server.js';
import logger from '../lib/logger.js';
import ServerError from '../lib/ServerError.js';

const DEFAULT_CONCURRENCY = 3;

program
  .name('pos-cli gui serve')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('-p, --port <port>', 'use PORT', '3333')
  .option('-o, --open', 'when ready, open default browser with graphiql')
  .option('-s, --sync', 'Sync files')
  .action(async (environment, params) => {
    const authData = fetchSettings(environment, program);

    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      PORT: params.port,
      CONCURRENCY: process.env.CONCURRENCY || DEFAULT_CONCURRENCY
    });

    try {
      const client = await SwaggerProxy.client(environment);
      server(env, client);
      if (params.open) {
        try {
          const open = (await import('open')).default;
          await open(`http://localhost:${params.port}`);
        } catch (error) {
          if (error instanceof AggregateError) {
            logger.Error(`Failed to open browser (${error.errors.length} attempts): ${error.message}`);
          } else {
            logger.Error(`Failed to open browser: ${error.message}`);
          }
        }
      }

      if (params.sync){
        await watch(env, true, false);
      }
    } catch (e) {
      if (ServerError.isNetworkError(e)) {
        ServerError.handler(e);
      } else {
        logger.Error(`Failed: ${e.message || e}`);
      }
    }
  });

program.parse(process.argv);
