#!/usr/bin/env node

const fs = require('fs');
const { program } = require('commander');
const Gateway = require('../lib/proxy');
const fetchAuthData = require('../lib/settings').fetchSettings;
const logger = require('../lib/logger');
const { isProductionEnvironment, confirmProductionExecution } = require('../lib/productionEnvironment');

program
  .name('pos-cli exec liquid')
  .argument('<environment>', 'name of environment. Example: staging')
  .argument('[code]', 'liquid code to execute as string')
  .option('-f, --file <path>', 'path to liquid file to execute')
  .action(async (environment, code, options) => {
    let liquidCode = code;

    if (options.file) {
      if (!fs.existsSync(options.file)) {
        logger.Error(`File not found: ${options.file}`);
        process.exit(1);
      }
      liquidCode = fs.readFileSync(options.file, 'utf8');
    }

    if (!liquidCode) {
      logger.Error("error: missing required argument 'code'");
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
      const response = await gateway.liquid({ content: liquidCode });

      if (response.error) {
        logger.Error(`Liquid execution error: ${response.error}`);
        process.exit(1);
      }

      if (response.result) {
        logger.Print(response.result);
      }
    } catch (error) {
      logger.Error(`Failed to execute liquid: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);