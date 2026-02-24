#!/usr/bin/env node

import fs from 'fs';
import { program } from '../lib/program.js';
import Gateway from '../lib/proxy.js';
import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';
import { isProductionEnvironment, confirmProductionExecution } from '../lib/productionEnvironment.js';

program
  .name('pos-cli exec graphql')
  .argument('<environment>', 'name of environment. Example: staging')
  .argument('[graphql]', 'graphql query to execute as string')
  .option('-f, --file <path>', 'path to graphql file to execute')
  .action(async (environment, graphql, options) => {
    let query = graphql;

    if (options.file) {
      if (!fs.existsSync(options.file)) {
        logger.Error(`File not found: ${options.file}`);
        process.exit(1);
      }
      query = fs.readFileSync(options.file, 'utf8');
    }

    if (!query) {
      logger.Error("error: missing required argument 'graphql'");
      process.exit(1);
    }

    const authData = await fetchSettings(environment, program);
    const gateway = new Gateway(authData);

    if (isProductionEnvironment(environment)) {
      const confirmed = await confirmProductionExecution(environment);
      if (!confirmed) {
        logger.Info('Execution cancelled.');
        process.exit(0);
      }
    }

    try {
      const response = await gateway.graph({ query });

      if (response.errors) {
        logger.Error(`GraphQL execution error: ${JSON.stringify(response.errors, null, 2)}`);
        process.exit(1);
      }

      if (response.data) {
        logger.Print(JSON.stringify(response, null, 2));
      }
    } catch (error) {
      logger.Error(`Failed to execute graphql: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);