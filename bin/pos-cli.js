#!/usr/bin/env node

import { program } from 'commander';
import updateNotifier from 'update-notifier';
import pkg from '../package.json' with { type: 'json' };

const version = pkg.version;

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
  .command('check', 'check Liquid code quality with platformos-check linter')
  .command('clone', 'clone instances')
  .command('constants', 'manage constants')
  .command('data', 'export, import or clean data on instance')
  .command('deploy <environment>', 'deploy code to environment').alias('d')
  .command('env', 'manage environments')
  .command('exec', 'execute code on instance')
  .command('gui', 'gui for content editor, graphql, logs')
  .command('generate', 'generates files')
  .command('init', 'initialize directory structure')
  .command('logs <environment>', 'display logs and errors').alias('l')
  .command('logsv2', 'display logs and errors').alias('l2')
  .command('lsp', 'start a Language Server Protocol server')
  .command('migrations', 'manage migrations')
  .command('modules', 'manage modules')
  .command('pull', 'export app data to a zip file')
  .command('sync <environment>', 'update environment on file change').alias('s')
  .command('test', 'run tests on instance')
  .command('uploads', 'manage uploads files')
  .command('fetch-logs', 'fetch logs')
  .parse(process.argv);
