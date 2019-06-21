#!/usr/bin/env node

const program = require('commander'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  spawn = require('child_process').spawn,
  command = require('./lib/command'),
  logger = require('./lib/logger'),
  Gateway = require('./lib/proxy'),
  deployServiceClient = require('./lib/deployServiceClient'),
  version = require('./package.json').version;

const uploadArchive = (env, usingDeploymentService) => {
  const options = usingDeploymentService ? ['--without-assets'] : [];
  const archive = spawn(command('marketplace-kit-archive'), options, {
    stdio: 'inherit'
  });

  archive.on('close', code => {
    if (code === 1) {
      logger.Error('Deploy failed.');
      process.exit(1);
    }

    const push = spawn(command('marketplace-kit-push'), [], {
      stdio: 'inherit',
      env: env
    });

    push.on('close', exitCode => {
      if (exitCode === 1) {
        logger.Error('Deploy failed.');
        process.exit(1);
      } else if(exitCode === 0) {
        process.exit(0);
      }
    });
  });
};

program
  .version(version)
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('-f --force', 'force update. Removes instance-admin lock')
  .option('-d --direct-assets-upload', 'Uploads assets straight to S3 servers')
  .option('-p --partial-deploy', 'Partial deployment, does not remove data from directories missing from the build')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    if (params.force) process.env.FORCE = params.force;
    if (params.partialDeploy) process.env.PARTIAL_DEPLOY = params.partialDeploy;
    const authData = fetchAuthData(environment, program);
    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      MARKETPLACE_ENV: environment
    });

    if (params.directAssetsUpload) {
      const gateway = new Gateway(authData);
      deployServiceClient.deployAssets(gateway).then(
        () => {
          logger.Success('Assets deployed to S3. Uploading manifest.');
          uploadArchive(env, true);
        },
        err => {
          logger.Debug(err);
          logger.Warn('Communication problem with deployment service, using classic deployment.');
          uploadArchive(env, false);
        }
      );
    } else {
      uploadArchive(env, false);
    }
  });

program.parse(process.argv);
