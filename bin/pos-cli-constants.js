#!/usr/bin/env node

import { program } from 'commander';

program
  .name('pos-cli constants')
  .command(
    'set [environment]',
    'set new constant. Example: pos-cli constants set stating --name TOKEN --value SECRET_TOKEN'
  )
  .command(
    'unset [environment]',
    'Unset new constant. Example: pos-cli constants unset stating --name TOKEN'
  )
  .command(
    'list [environment]',
    `List all constants. If you want to show values of constants, use SAFE=1 environment variable.
                     Example: SAFE=1 pos-cli constants list staging
    `
  )
  .parse(process.argv);
