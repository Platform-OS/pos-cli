#!/usr/bin/env node

import { program } from '../lib/program.js';
import { fetchSettings } from '../lib/settings.js';
import { run } from '../lib/test-runner/index.js';

program
  .name('pos-cli test run')
  .argument('<environment>', 'name of environment. Example: staging')
  .argument('[name]', 'name of test to execute (runs all tests if not provided)')
  .action(async (environment, name) => {
    const authData = await fetchSettings(environment, program);
    const success = await run(authData, environment, name);
    process.exit(success ? 0 : 1);
  });

program.parse(process.argv);
