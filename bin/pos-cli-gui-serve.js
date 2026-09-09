#!/usr/bin/env node
import { SwaggerProxy } from '../lib/swagger-client.js';

import { program } from '../lib/program.js';
import { start as watch, setupGracefulShutdown } from '../lib/watch.js';

import { fetchSettings } from '../lib/settings.js';
import { start as server } from '../lib/server.js';
import logger from '../lib/logger.js';
import ServerError from '../lib/ServerError.js';
import { ensureSessionForCommand } from '../lib/twoFactorSession.js';
import { partnerPortalEnv } from '../lib/portal.js';

const DEFAULT_CONCURRENCY = 3;

program
  .name('pos-cli gui serve')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('-p, --port <port>', 'use PORT', '3333')
  .option('-b, --host <host>', 'use HOST', 'localhost')
  .option('-o, --open', 'when ready, open default browser with graphiql')
  .option('-s, --sync', 'Sync files')
  .option(
    '--otp-code <otpCode>',
    'two-factor code (or a recovery code) for the session, when this instance requires one. Can also be set as POS_PORTAL_OTP_CODE'
  )
  .action(async (environment, params) => {
    const authData = await fetchSettings(environment, program);

    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      HOST: params.host,
      PORT: params.port,
      CONCURRENCY: process.env.CONCURRENCY || DEFAULT_CONCURRENCY,
      ...partnerPortalEnv(authData)
    });

    // Asked for before anything else, and not only when --sync is on: the GUI proxies
    // every panel query through the same credential, and SwaggerProxy.client below already
    // calls the instance. Without this the first step-up would be triggered by a browser
    // request or a file save and raise a readline prompt from inside a running web server,
    // where nobody is watching stdin. Here it is an ordinary prompt on an idle terminal.
    await ensureSessionForCommand(authData, params);

    // Names this command, not `pos-cli sync`, so an expired session tells the operator to
    // restart the thing they actually started — the GUI server comes down with the
    // watcher, so `pos-cli sync` alone would not bring it back. Handed to the web server
    // as well as to the watcher: the GUI proxies its panel queries through the same
    // credential, and it must not answer a refused one with a prompt either.
    const restartCommand = ['pos-cli gui serve', environment, params.sync && '--sync']
      .filter(Boolean)
      .join(' ');

    try {
      const client = await SwaggerProxy.client(environment);
      server(env, client, { restartCommand });
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
        const { watcher, liveReloadServer } = await watch(env, true, false, { restartCommand });
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
