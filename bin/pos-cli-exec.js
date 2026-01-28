#!/usr/bin/env node

import { program } from 'commander';

program
  .name('pos-cli exec')
  .command('liquid <environment> <code>', 'execute liquid code on instance')
  .command('graphql <environment> <graphql>', 'execute graphql query on instance')
  .parse(process.argv);
