#!/usr/bin/env node

import { program } from '../lib/program.js';
import Gateway from '../lib/proxy.js';
import { existence as validateExistence } from '../lib/validators/index.js';
import { unsetConstant } from '../lib/graph/queries.js';
import { graphQLErrorMessage } from '../lib/graph/response.js';
import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';

const help = () => {
  program.outputHelp();
  process.exit(1);
};

const checkParams = ({name}) => {
  validateExistence({ argumentValue: name, argumentName: 'name', fail: help });
};

program
  .name('pos-cli constants unset')
  .option('--name <name>', 'name of constant. Example: TOKEN')
  .arguments('[environment]', 'name of environment. Example: staging')
  .action(async (environment, params) => {
    checkParams(params);
    const authData = await fetchSettings(environment, program);
    const gateway = new Gateway(authData);

    gateway
      .graph(unsetConstant(params.name))
      .then((msg) => {
        const errorMessage = graphQLErrorMessage(msg);
        if (errorMessage) throw new Error(errorMessage);

        if (msg.data.constant_unset)
          logger.Success(`Constant variable <${msg.data.constant_unset.name}> deleted successfully.`);
        else
          logger.Success('Constant variable not found.');
      })
      .catch(async (err) => {
        await logger.Error(`Deleting Constant variable <${params.name}> failed: ${err.message || err}`);
      });
  });

program.parse(process.argv);
