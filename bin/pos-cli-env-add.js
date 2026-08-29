#!/usr/bin/env node

import { program } from '../lib/program.js';
import { reportCommandError } from '../lib/reportCommandError.js';
import addEnv from '../lib/envs/add.js';

program.showHelpAfterError();
program
  .name('pos-cli env add')
  .arguments('<environment>', 'name of environment. Example: staging')
  .option('--email <email>', 'Partner Portal account email. Example: admin@example.com')
  .requiredOption('--url <url>', 'marketplace url. Example: https://example.com')
  .option(
    '--partner-portal-url <partnerPortalUrl>',
    'Partner Portal managing this instance, stored with the environment. Example: https://portal.private-stack.online',
    'https://partners.platformos.com'
  )
  .option(
    '--token <token>',
    'if you have a token you can add it directly to pos-cli configuration without connecting to portal'
  )
  .option(
    '--otp-code <otpCode>',
    'two-factor code (or a recovery code) for accounts with 2FA enabled. Can also be set as POS_PORTAL_OTP_CODE. Only needed with --email; you are prompted for one when it is missing'
  )
  .action(async (environment, params) => {
    try {
      await addEnv(environment, params);
    } catch (e) {
      await reportCommandError(e);
    }
  });

program.parse(process.argv);
