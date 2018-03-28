#!/usr/bin/env node

const program = require('commander'),
  spawn = require('child_process').spawn,
  command = require('./lib/command'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  version = require('./package.json').version;

program
  .version(version)
  .arguments('<environment>', 'Name of environment. Example: staging')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment);
    const env = Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url
    });
    const p = spawn(command('marketplace-kit-watch'), [], { stdio: 'inherit', env: env });

    p.on('close', code => {
      if (code === 1) {
        console.error('✖ failed.');
      }
    });
    p.on('error', error => {
      console.error(error);
    });
  });

program.parse(process.argv);
if (!program.args.length) {
  program.help();
  process.exit(1);
}
