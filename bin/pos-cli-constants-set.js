#!/usr/bin/env node

const { program } = require('commander'),
      Gateway = require('../lib/proxy'),
      validate = require('../lib/validators'),
      queries = require('../lib/graph/queries'),
      fetchAuthData = require('../lib/settings').fetchSettings,
      logger = require('../lib/logger');

const help = () => {
  program.outputHelp();
  process.exit(1);
}

const checkParams = ({name, value}) => {
  validate.existence({ argumentValue: value, argumentName: 'value', fail: help });
  validate.existence({ argumentValue: name, argumentName: 'name', fail: help });
}

const success = (msg) => {
  logger.Success(`Constant variable <${msg.data.constant_set.name}> added successfuly.`)
}

const error = (msg) => {
  logger.Error(`Adding Constant variable <${msg.data.constant_set.name}> failed successfuly.`)
}

program
  .name('pos-cli constants set')
  .option('--name <name>', 'name of constant. Example: TOKEN')
  .option('--value <value>', 'value of constant. Example: TOKEN')
  .arguments('[environment]', 'name of environment. Example: staging')
  .action((environment, params) => {
    checkParams(params);
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);

    const constant = gateway
          .graph({query: queries.setConstant(params.name, params.value)})
          .then(success)
          .catch(error);
  });

program.parse(process.argv);
