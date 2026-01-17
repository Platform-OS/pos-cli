#!/usr/bin/env node

import { program } from 'commander';
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
  .action(async (params) => {
    try {
      if (params.path) process.chdir(params.path);
      checkParams(params);
      await publishVersion(params);
    }
    catch(e) { console.log(e) }
  });

program.showHelpAfterError();
program.parse(process.argv);
