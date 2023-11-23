#!/usr/bin/env node

const program = require('commander');

const modules = require('../lib/modules');
const validate = require('../lib/validators');

const help = () => {
  program.outputHelp();
  process.exit(1);
}

const checkParams = params => {
  validate.existence({ argumentValue: params.email, argumentName: 'email', fail: help });
  validate.email(params.email);
};

program
  .name('pos-cli modules push')
  .option('--email <email>', 'Partner Portal account email. Example: foo@example.com')
  .option('--path <path>', 'module root directory, default is current directory')
  .action(async (params) => {
    if (params.path) process.chdir(params.path);
    checkParams(params);
    await modules.publishVersion(params);
  });

program.parse(process.argv);
