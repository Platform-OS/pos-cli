#!/usr/bin/env node
import { SwaggerProxy } from '../lib/swagger-client.js';

import { program } from '../lib/program.js';
import { start as watch, setupGracefulShutdown } from '../lib/watch.js';

import { fetchSettings } from '../lib/settings.js';
import { start as server } from '../lib/server.js';
import logger from '../lib/logger.js';
import ServerError from '../lib/ServerError.js';

const DEFAULT_CONCURRENCY = 3;

program
  .name('pos-cli gui serve')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('-p, --port <port>', 'use PORT', '3333')
  .option('-b, --host <host>', 'use HOST', 'localhost')
  .option('-o, --open', 'when ready, open default browser with graphiql')
  .option('-s, --sync', 'Sync files')
  .action(async (environment, params) => {
    const authData = await fetchSettings(environment, program);

    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      HOST: params.host,
      PORT: params.port,
      CONCURRENCY: process.env.CONCURRENCY || DEFAULT_CONCURRENCY
    });

    try {
      const client = await SwaggerProxy.client(environment);
      server(env, client);
      if (params.open) {
        try {
          const open = (await import('open')).default;
          await open(`http://${params.host}:${params.port}`);
        } catch (error) {
          if (error instanceof AggregateError) {
            logger.Error(`Failed to open browser (${error.errors.length} attempts): ${error.message}`);
          } else {
            logger.Error(`Failed to open browser: ${error.message}`);
          }
        }
      }

      if (params.sync){
        const { watcher, liveReloadServer } = await watch(env, true, false);
        setupGracefulShutdown({ watcher, liveReloadServer, context: 'GUI' });
      }
    } catch (e) {
      if (ServerError.isNetworkError(e)) {
        await ServerError.handler(e);
      } else {
        await logger.Error(`Failed: ${e.message || e}`);
      }
    }
  });

program.parse(process.argv);
