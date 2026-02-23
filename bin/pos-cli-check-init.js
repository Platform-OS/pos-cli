#!/usr/bin/env node
import { program } from '../lib/program.js';
import { initConfig } from '../lib/check.js';

program
  .name('pos-cli check init')
  .description('initialize .platformos-check.yml configuration file')
  .argument('[path]', 'path to initialize config in (defaults to current directory)', process.cwd())
  .action(async (configPath) => {
    await initConfig(configPath);
  });

program.parse(process.argv);
