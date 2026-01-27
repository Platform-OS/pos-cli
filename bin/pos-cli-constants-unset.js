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

const checkParams = ({name}) => {
  validateExistence({ argumentValue: name, argumentName: 'name', fail: help });
};

const success = (msg) => {
  if (msg.data.constant_unset)
    logger.Success(`Constant variable <${msg.data.constant_unset.name}> deleted successfully.`);
  else
    logger.Success('Constant variable not found.');
};

const error = (msg) => {
  logger.Error(`Deleting Constant variable <${msg.data.constant_unset.name}> failed.`);
};

program
  .name('pos-cli constants unset')
  .option('--name <name>', 'name of constant. Example: TOKEN')
  .arguments('[environment]', 'name of environment. Example: staging')
  .action((environment, params) => {
    checkParams(params);
    const authData = fetchSettings(environment, program);
    const gateway = new Gateway(authData);

    gateway
      .graph({query: queries.unsetConstant(params.name)})
      .then(success)
      .catch(error);
  });

program.parse(process.argv);
