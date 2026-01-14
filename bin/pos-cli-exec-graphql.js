#!/usr/bin/env node

const { program } = require('commander');
const prompts = require('prompts');
const Gateway = require('../lib/proxy');
const fetchAuthData = require('../lib/settings').fetchSettings;
const logger = require('../lib/logger');

const isProductionEnvironment = (environment) => {
  return environment && (environment.toLowerCase().includes('prod') || environment.toLowerCase().includes('production'));
};

const confirmProductionExecution = async (environment) => {
  logger.Warn(`WARNING: You are executing GraphQL on a production environment: ${environment}`);
  logger.Warn('This could potentially modify production data or cause unintended side effects.');
  logger.Warn('');

  const response = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: `Are you sure you want to continue executing on ${environment}?`,
    initial: false
  });

  return response.confirmed;
};

program
  .name('pos-cli exec graphql')
  .argument('<environment>', 'name of environment. Example: staging')
  .argument('<graphql>', 'graphql query to execute as string')
  .action(async (environment, graphql) => {
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