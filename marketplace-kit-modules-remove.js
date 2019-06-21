#!/usr/bin/env node

const program = require('commander'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/logger'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  version = require('./package.json').version;

program
  .version(version)
  .arguments('[environment]', 'name of the environment. Example: staging')
  .arguments('<name>', 'name of the module. Example: admin_cms')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, name, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);
    const formData = { pos_module_name: name };

    gateway
      .removeModule(formData)
      .then(() => {
        logger.Success(`[Module Remove] Successfully removed module ${name}`);
      })
      .catch(error => logger.Error('Failed to remove the module ', error));
  });

program.parse(process.argv);
