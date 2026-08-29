#!/usr/bin/env node

import { program } from '../lib/program.js';
import { start as watchStart, setupGracefulShutdown, sendFile } from '../lib/watch.js';

import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';
import Gateway from '../lib/proxy.js';
import { ensureSession } from '../lib/twoFactorSession.js';
import { reportCommandError } from '../lib/reportCommandError.js';

const DEFAULT_CONCURRENCY = 3;

// Letting a TwoFactorError escape the action would print a stack trace over the message it
// carries. Anything else keeps its existing behaviour.
const ensureTwoFactorSession = async (authData, params) => {
  try {
    await ensureSession({
      portalUrl: authData.partner_portal_url,
      instanceUrl: authData.url,
      token: authData.token,
      otpCode: params.otpCode
    });
  } catch (e) {
    if (e.name !== 'TwoFactorError') throw e;

    await reportCommandError(e);
  }
};

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
      // watch.js rebuilds the Gateway's settings from these env vars, losing the
      // environment's partner_portal_url on the way; the Gateway reads it back from here
      // so a two-factor session lands under the right portal. Same export `deploy` does.
      PARTNER_PORTAL_HOST: process.env.PARTNER_PORTAL_HOST || authData.partner_portal_url
    });

    // Asked for before the watcher starts and before any spinner: sync then runs
    // unattended for hours, and a prompt raised underneath a spinner is painted over.
    await ensureTwoFactorSession(authData, params);

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
