#!/usr/bin/env node
import { program } from '../lib/program.js';

import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';
import deployStrategy from '../lib/deploy/strategy.js';

program
  .name('pos-cli deploy')
  .argument('[environment]', 'name of environment. Example: staging')
  .option('-f --force', 'deprecated')
  .option('-d --direct-assets-upload', 'deprecated, this is default strategy')
  .option('-o --old-assets-upload', 'use old assets upload strategy')
  .option('-p --partial-deploy', 'Partial deployment, does not remove data from directories missing from the build')
  .option('--dry-run', 'Validate the release on the server without applying any changes')
  .action(async (environment, params) => {
    if (params.force) logger.Warn('-f flag is deprecated and does not do anything.');

    if (params.dryRun && !process.env.DEV) {
      logger.Warn('--dry-run is temporarily disabled. This feature will be enabled soon.');
      process.exit(0);
    }

    let strategy;
    if (params.dryRun) {
      strategy = 'dryRun';
    } else if (params.oldAssetsUpload) {
      strategy = 'default';
    } else {
      strategy = 'directAssetsUpload';
    }
    const authData = await fetchSettings(environment, program);
    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      PARTNER_PORTAL_HOST: authData.partner_portal_url,
      MARKETPLACE_ENV: environment,
      CI: process.env.CI === 'true',
      // TODO: Get rid off global system env, make it normal argument to function.
      PARTIAL_DEPLOY: !!params.partialDeploy,
      DIRECT_ASSETS_UPLOAD: !params.oldAssetsUpload
    });

    deployStrategy.run({ strategy, opts: { env, authData, params } });
  });

program.parse(process.argv);
