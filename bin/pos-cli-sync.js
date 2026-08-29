#!/usr/bin/env node

import { program } from '../lib/program.js';
import { start as watchStart, setupGracefulShutdown, sendFile } from '../lib/watch.js';

import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';
import Gateway from '../lib/proxy.js';
import { ensureSessionForCommand } from '../lib/twoFactorSession.js';
import { partnerPortalEnv } from '../lib/portal.js';

const DEFAULT_CONCURRENCY = 3;

program
  .name('pos-cli sync')
  .argument('[environment]', 'Name of environment. Example: staging')
  .option('-c, --concurrency <number>', 'Maximum concurrent connections to the server', DEFAULT_CONCURRENCY)
  .option('-d, --direct-assets-upload', 'deprecated, this is the default strategy', true)
  .option('-o, --open', 'When ready, open default browser with instance')
  .option('-f, --file-path <file-path>', 'sync single file and exit')
  .option('-l, --livereload', 'Use livereload')
  .option(
    '--otp-code <otpCode>',
    'two-factor code (or a recovery code) for the deploy session, when this instance requires one. Can also be set as POS_PORTAL_OTP_CODE'
  )
  .action(async (environment, params) => {
    const authData = await fetchSettings(environment);
    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      CONCURRENCY: process.env.CONCURRENCY || params.concurrency,
      ...partnerPortalEnv(authData)
    });

    // Asked for before the watcher starts and before any spinner: sync then runs
    // unattended for hours, and a prompt raised underneath a spinner is painted over.
    await ensureSessionForCommand(authData, params);

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
    const { watcher, liveReloadServer } = await watchStart(env, params.directAssetsUpload, params.livereload, {
      // Named so an expired session prints a line the operator can copy verbatim: it has
      // to restart *this* run, and the environment is not recoverable from the message
      // otherwise. Only watch mode gets this — the `sync -f` path above is one request and
      // steps up in place, which is right for a command that exits straight after.
      restartCommand: ['pos-cli sync', environment].filter(Boolean).join(' ')
    });

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
