#!/usr/bin/env node

const { program } = require('commander');
const modules = require('../lib/modules');
const validate = require('../lib/validators');

const checkParams = params => {
  validate.email(params.email);
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
      await modules.publishVersion(params);
    }
    catch(e) { console.log(e) }
  });

program.showHelpAfterError();
program.parse(process.argv);
