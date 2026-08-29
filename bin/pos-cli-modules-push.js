#!/usr/bin/env node

import { program } from '../lib/program.js';
import { publishVersion } from '../lib/modules.js';
import { email } from '../lib/validators/index.js';

const checkParams = params => {
  email(params.email);
};

program
  .name('pos-cli modules push')
  .requiredOption('--email <email>', 'Partner Portal account email. Example: foo@example.com')
  .option('--path <path>', 'module root directory, default is current directory')
  .option('--name <name>', 'name of the module you would like to publish')
  .option(
    '--otp-code <otpCode>',
    'two-factor code (or a recovery code) for accounts with 2FA enabled. Can also be set as POS_PORTAL_OTP_CODE. Only needed with --email; you are prompted for one when it is missing'
  )
  .action(async (params) => {
    if (params.path) process.chdir(params.path);
    checkParams(params);
    await publishVersion(params);
  });

program.showHelpAfterError();
program.parse(process.argv);
