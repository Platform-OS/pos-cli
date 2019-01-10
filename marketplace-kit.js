#!/usr/bin/env node

const program = require('commander'),
  updateNotifier = require('update-notifier'),
  pkg = require('./package.json'),
  version = pkg.version;

updateNotifier({
  pkg: pkg
}).notify({
  defer: true,
  isGlobal: true
});

program
  .version(version)
  .command('audit', 'check your code for deprecations, recommendations, errors')
  .command('data', 'export, import or clean data on instance')
  .command('deploy <environment>', 'deploy code to environment')
  .alias('d')
  .command('env', 'manage environments')
  .command('gui', 'gui for content editor, graphql')
  .command('init', 'initialize required directory structure')
  .command('logs <environment>', 'attach to environment log streams')
  .command('migrations', 'generate or run a migration')
  .command('sync <environment>', 'update environment on file change')
  .parse(process.argv);

if (!program.args.length) program.help();
