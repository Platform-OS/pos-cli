#!/usr/bin/env node

const program = require('commander'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  spawn = require('child_process').spawn,
  command = require('./lib/command'),
  logger = require('./lib/kit').logger,
  version = require('./package.json').version;

program
  .version(version)
  .arguments('<environment>', 'name of environment. Example: staging')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .option('-p --port <port>', 'use PORT', '3333')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment);
    const env = Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      MARKETPLACE_EMAIL: authData.email,
      PORT: params.port
    });

    const server = spawn(command('marketplace-kit-server'), [], { stdio: 'inherit' });

    server.on('close', code => {
      if (code === 1) {
        logger.Error('✖ failed.');
        process.exit(1);
      }
    });
  });

program.parse(process.argv);
if (!program.args.length) {
  program.help();
  process.exit(1);
}
