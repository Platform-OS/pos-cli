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
  .option('-f --force', 'force update. Removes files that are not present in deployed release')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    process.env.FORCE = params.force;
    const authData = fetchAuthData(environment);
    const env = Object.assign(process.env, { MARKETPLACE_TOKEN: authData.token, MARKETPLACE_URL: authData.url });

    // make an archive
    const archive = spawn(command('marketplace-kit-archive'), [], { stdio: 'inherit' });

    archive.on('close', code => {
      if (code === 1) {
        logger.Error('✖ failed.');
        process.exit(1);
      }

      const push = spawn(command('marketplace-kit-push'), [], { stdio: 'inherit', env: env });
      push.on('close', code => {
        if (code === 1) {
          logger.Error('✖ failed.');
          process.exit(1);
        }
      });
    });
  });

program.parse(process.argv);
if (!program.args.length) {
  program.help();
  process.exit(1);
}
