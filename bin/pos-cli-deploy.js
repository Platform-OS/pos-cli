#!/usr/bin/env node
import { program } from '../lib/program.js';

import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';
import deployStrategy from '../lib/deploy/strategy.js';
import { ensureSession } from '../lib/twoFactorSession.js';
import { reportCommandError } from '../lib/reportCommandError.js';

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
  .name('pos-cli deploy')
  .argument('[environment]', 'name of environment. Example: staging')
  .option('-f --force', 'deprecated')
  .option('-d --direct-assets-upload', 'deprecated, this is default strategy')
  .option('-o --old-assets-upload', 'use old assets upload strategy')
  .option('-p --partial-deploy', 'Partial deployment, does not remove data from directories missing from the build')
  .option('--dry-run', 'Validate the release on the server without applying any changes')
  .option('-v, --verbose', 'Show full file paths in deploy report (default: summary only)')
  .option(
    '--otp-code <otpCode>',
    'two-factor code (or a recovery code) for the deploy session, when this instance requires one. Can also be set as POS_PORTAL_OTP_CODE'
  )
  .action(async (environment, params) => {
    if (params.force) logger.Warn('-f flag is deprecated and does not do anything.');

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
      DIRECT_ASSETS_UPLOAD: !params.oldAssetsUpload,
      VERBOSE: !!params.verbose
    });

    // Before any work or any spinner: if this instance needs a two-factor session, ask for
    // the code now rather than partway through the upload.
    await ensureTwoFactorSession(authData, params);

    deployStrategy.run({ strategy, opts: { env, authData, params } });
  });

program.parse(process.argv);
