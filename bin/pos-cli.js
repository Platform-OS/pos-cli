#!/usr/bin/env node

const program = require('commander'),
  updateNotifier = require('update-notifier'),
  pkg = require('../package.json'),
  logger = require('../lib/logger'),
  version = pkg.version;

updateNotifier({
  pkg: pkg
}).notify({
  defer: true,
  isGlobal: true
});

program
  .name('pos-cli')
  .version(version, '-v, --version')
  .command('audit', 'check your code for deprecations, recommendations, errors')
  .command('env', 'manage environments')
  .command('data', 'export, import or clean data on instance')
  .command('pull', 'export app data to a zip file')
  .command('deploy <environment>', 'deploy code to environment')
  .alias('d')
  .command('gui', 'gui for content editor, graphql')
  .command('init', 'initialize directory structure')
  .command('logs <environment>', 'display logs and errors')
  .alias('l')
  .command('migrations', 'manage migrations')
  .command('modules', 'manage modules')
  .command('sync <environment>', 'update environment on file change')
  .alias('s')
  .parse(process.argv);

const commandList = Object.keys(program._execs);

if (!commandList.includes(program.args[0])) {
  program.outputHelp();
  logger.Error(`unknown command: ${program.args[0]}`);
}

if (!program.args.length) program.help();
