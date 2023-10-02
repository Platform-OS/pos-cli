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

program.showHelpAfterError();
program
  .name('pos-cli')
  .version(version, '-v, --version')
  .command('archive', 'create an archive only (no deployment)')
  .command('audit', 'check your code for deprecations, recommendations, errors')
  .command('constants', 'manage constants')
  .command('data', 'export, import or clean data on instance')
  .command('deploy <environment>', 'deploy code to environment').alias('d')
  .command('env', 'manage environments')
  .command('gui', 'gui for content editor, graphql, logs')
  .command('init', 'initialize directory structure')
  .command('logs <environment>', 'display logs and errors').alias('l')
  .command('logsv2', 'display logs and errors').alias('l2')
  .command('migrations', 'manage migrations')
  .command('modules', 'manage modules')
  .command('pull', 'export app data to a zip file')
  .command('sync <environment>', 'update environment on file change').alias('s')
  .command('uploads', 'manage uploads files')
  .parse(process.argv);

