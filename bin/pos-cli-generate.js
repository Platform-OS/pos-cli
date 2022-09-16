#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli generate')
  .command('command', 'Generate command with build and check files')
  .command('resource', 'Generate model and endpoints files for create, read, update and delete')
  .command('rest-api', 'Generate rest api endpoints files')
  .parse(process.argv);

const commandList = Object.keys(program._execs);
if (!commandList.includes(program.args[0])) {
  program.outputHelp();
  console.log(`unknown command: ${program.args[0]}`);
}

if (!program.args.length) program.help();
