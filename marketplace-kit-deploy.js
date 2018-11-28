#!/usr/bin/env node

const program = require('commander'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  spawn = require('child_process').spawn,
  command = require('./lib/command'),
  logger = require('./lib/logger'),
  validate = require('./lib/validators'),
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
    }
    const push = spawn(command('marketplace-kit-push'), [], {
      stdio: 'inherit',
      env: env
    });
  });
};

const hasEnvSet = envValue => !(envValue == null || envValue == 'undefined');

program
  .version(version)
  .arguments('<environment>', 'name of environment. Example: staging')
  .option('-f --force', 'force update. Removes instance-admin lock')
  .option('-d --skip-deployment-service', 'Skip deployment service which uploads assets straight to S3 servers')
  .option('-p --partial-deploy', 'Partial deployment, does not remove data from directories missing from the build')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    if (params.force) process.env.FORCE = params.force;
    if (params.partialDeploy) process.env.PARTIAL_DEPLOY = params.partialDeploy;
    if (params.skipDeployService) process.env.SKIP_DEPLOY_SERVICE = params.skipDeployService;
    const authData = fetchAuthData(environment);
    const env = Object.assign(process.env, {
      MARKETPLACE_EMAIL: authData.email,
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
      MARKETPLACE_ENDPOINT_URL: authData.endpointUrl,
      MARKETPLACE_ENV: environment
    });

    if (process.env.SKIP_DEPLOY_SERVICE || !hasEnvSet(env.MARKETPLACE_ENDPOINT_URL)) {
      uploadArchive(env, false);
    } else {
      deployServiceClient.deployAssets(env).then(
        () => {
          logger.Success('Assets deployed to S3. Uploading manifest.');
          uploadArchive(env, true);
        },
        err => {
          logger.Debug('Communication problem with deployment service, using classic deployment.');
          uploadArchive(env, false);
        }
      );
    }
  });

program.parse(process.argv);

validate.existence({
  argumentValue: program.args[0],
  argumentName: 'environment',
  fail: program.help.bind(program)
});
