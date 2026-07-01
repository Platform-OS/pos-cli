#!/usr/bin/env node

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { execGraphql } from '../lib/exec/graphql.js';

program
  .name('pos-cli exec graphql')
  .argument('<environment>', 'name of environment. Example: staging')
  .argument('[graphql]', 'graphql query to execute as string')
  .option('-f, --file <path>', 'path to graphql file to execute')
  .option('-p, --params <json>', 'GraphQL variables as a JSON object. Example: \'{"id":"42"}\'')
  .action(async (environment, graphql, options) => {
    try {
      const { response, cancelled } = await execGraphql({
        environment,
        query: graphql,
        file: options.file,
        params: options.params,
        program,
      });

      if (cancelled) {
        logger.Info('Execution cancelled.');
        process.exit(0);
      }

      if (response.errors) {
        await logger.Error(`GraphQL execution error: ${JSON.stringify(response.errors, null, 2)}`);
        process.exit(1);
      }

      if (response.data) {
        logger.Print(JSON.stringify(response, null, 2));
      }
    } catch (error) {
      await logger.Error(`Failed to execute graphql: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
