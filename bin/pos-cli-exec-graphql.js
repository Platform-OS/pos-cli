#!/usr/bin/env node

const { program } = require('commander');
const Gateway = require('../lib/proxy');
const fetchAuthData = require('../lib/settings').fetchSettings;
const logger = require('../lib/logger');

program
  .name('pos-cli exec graphql')
  .argument('<environment>', 'name of environment. Example: staging')
  .argument('<graphql>', 'graphql query to execute as string')
  .action(async (environment, graphql) => {
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);

    try {
      const response = await gateway.graph({ query: graphql });

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