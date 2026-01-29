#!/usr/bin/env node
import { program } from 'commander';

program
  .name('pos-cli check')
  .command('run [path]', 'check Liquid code quality with platformos-check linter')
  .command('init [path]', 'initialize .platformos-check.yml configuration file')
  .parse(process.argv);
