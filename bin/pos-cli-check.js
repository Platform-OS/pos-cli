#!/usr/bin/env node
import { program } from '../lib/program.js';

program
  .name('pos-cli check')
  .command('run [path]', 'check Liquid code quality with platformos-check linter')
  .command('init [path]', 'initialize .platformos-check.yml configuration file')
  .command('update-docs', 'download the latest platformOS Liquid documentation used by the linter')
  .parse(process.argv);
