#!/usr/bin/env node

import { program } from '../lib/program.js';
import Gateway from '../lib/proxy.js';
import { existence as validateExistence } from '../lib/validators/index.js';
import { setConstant } from '../lib/graph/queries.js';
import { graphQLErrorMessage } from '../lib/graph/response.js';
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
      .graph(setConstant(params.name, params.value))
      .then((msg) => {
        const errorMessage = graphQLErrorMessage(msg);
        if (errorMessage) {
          logger.Error(`Adding Constant variable <${params.name}> failed: ${errorMessage}`);
          return;
        }
        logger.Success(`Constant variable <${msg.data.constant_set.name}> added successfully.`);
      })
      .catch((err) => {
        logger.Error(`Adding Constant variable <${params.name}> failed: ${err.message || err}`);
      });
  });

program.parse(process.argv);
