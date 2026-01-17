#!/usr/bin/env node

const fs = require('fs');
const { program } = require('commander');
const Gateway = require('../lib/proxy');
const fetchAuthData = require('../lib/settings').fetchSettings;
const logger = require('../lib/logger');
const { isProductionEnvironment, confirmProductionExecution } = require('../lib/productionEnvironment');

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

    const authData = fetchAuthData(environment, program);
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