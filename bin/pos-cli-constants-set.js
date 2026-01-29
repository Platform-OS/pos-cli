#!/usr/bin/env node

import { program } from 'commander';
import Gateway from '../lib/proxy.js';
import { existence as validateExistence } from '../lib/validators/index.js';
import queries from '../lib/graph/queries.js';
import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';

const help = () => {
  program.outputHelp();
  process.exit(1);
};

const checkParams = ({name, value}) => {
  validateExistence({ argumentValue: value, argumentName: 'value', fail: help });
  validateExistence({ argumentValue: name, argumentName: 'name', fail: help });
};

const success = (msg) => {
  logger.Success(`Constant variable <${msg.data.constant_set.name}> added successfully.`);
};

const error = (msg) => {
  logger.Error(`Adding Constant variable <${msg.data.constant_set.name}> failed.`);
};

program
  .name('pos-cli constants set')
  .option('--name <name>', 'name of constant. Example: TOKEN')
  .option('--value <value>', 'value of constant. Example: TOKEN')
  .arguments('[environment]', 'name of environment. Example: staging')
  .action(async (environment, params) => {
    checkParams(params);
    const authData = await fetchSettings(environment, program);
    const gateway = new Gateway(authData);

    gateway
      .graph({query: queries.setConstant(params.name, params.value)})
      .then(success)
      .catch(error);
  });

program.parse(process.argv);
