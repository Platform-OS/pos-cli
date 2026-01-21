#!/usr/bin/env node

import { program } from 'commander';
import { fetchSettings } from '../lib/settings.js';
import { run } from '../lib/test-runner/index.js';

program
  .name('pos-cli test run')
  .argument('<environment>', 'name of environment. Example: staging')
  .argument('[name]', 'name of test to execute (runs all tests if not provided)')
  .action(async (environment, name) => {
    console.log('dupa1');
    const authData = fetchSettings(environment, program);
    const success = await run(authData, environment, name);
    console.log(success);
    console.log('dupa');
    process.exit(success ? 0 : 1);
  });

program.parse(process.argv);
