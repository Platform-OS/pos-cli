#!/usr/bin/env node

const program = require('commander'),
  spawn = require('child_process').spawn,
  command = require('./lib/command'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  logger = require('./lib/kit').logger,
  validate = require('./lib/validators'),
  version = require('./package.json').version;

program
  .version(version)
  .arguments('<environment>', 'Name of environment. Example: staging')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment);
    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url
    });
    const p = spawn(command('marketplace-kit-watch'), [], { stdio: 'inherit', env: env });

    p.on('close', code => {
      if (code === 1) {
        logger.Error('✖ failed.');
      }
    });
    p.on('error', error => {
      logger.Error(error);
    });
  });

program.parse(process.argv);

validate.existence({
  argumentValue: program.environment,
  argumentName: 'environment',
  fail: program.help.bind(program)
});
