#!/usr/bin/env node

import { program } from '../lib/program.js';
import { start as watchStart, setupGracefulShutdown, sendFile } from '../lib/watch.js';

import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';
import Gateway from '../lib/proxy.js';

const DEFAULT_CONCURRENCY = 3;

program
  .name('pos-cli sync')
  .argument('[environment]', 'Name of environment. Example: staging')
  .option('-c, --concurrency <number>', 'Maximum concurrent connections to the server', DEFAULT_CONCURRENCY)
  .option('-d, --direct-assets-upload', 'deprecated, this is the default strategy', true)
  .option('-o, --open', 'When ready, open default browser with instance')
  .option('-f, --file-path <file-path>', 'sync single file and exit')
  .option('-l, --livereload', 'Use livereload')
  .action(async (environment, params) => {
    const authData = await fetchSettings(environment);
    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      CONCURRENCY: process.env.CONCURRENCY || params.concurrency
    });

    // Handle single file sync
    if (params.filePath) {
      const gateway = new Gateway({
        email: env.MARKETPLACE_EMAIL,
        token: env.MARKETPLACE_TOKEN,
        url: env.MARKETPLACE_URL
      });

      try {
        await sendFile(gateway, params.filePath);
        process.exit(0);
      } catch (error) {
        // If error was already logged (e.g., validation error), just exit
        if (error.alreadyLogged) {
          process.exit(1);
        }
        await logger.Error(`Failed to sync file: ${error.message}`);
        process.exit(1);
      }
    }

    // Continue with watch mode
    const { watcher, liveReloadServer } = await watchStart(env, params.directAssetsUpload, params.livereload);

    setupGracefulShutdown({ watcher, liveReloadServer, context: 'Sync' });

    if (params.open) {
      try {
        const open = (await import('open')).default;
        await open(`${authData.url}`);
      } catch (error) {
        if (error instanceof AggregateError) {
          logger.Error(`Failed to open browser (${error.errors.length} attempts): ${error.message}`);
        } else {
          logger.Error(`Failed to open browser: ${error.message}`);
        }
      }
    }
  });

program.parse(process.argv);
