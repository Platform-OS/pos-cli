#!/usr/bin/env node

const program = require('commander');
const logger = require('../lib/logger');
const validate = require('../lib/validators');
const Portal = require('../lib/portal');
const waitForStatus = require('../lib/data/waitForStatus');
const { readPassword } = require('../lib/utils/password');
const { storeEnvironment, deviceAuthorizationFlow } = require('../lib/environments');

const saveToken = (settings, token) => {
  storeEnvironment(Object.assign(settings, { token: token }));
  logger.Success(`Environment ${settings.url} as ${settings.environment} has been added successfuly.`);
};

const checkParams = (environment, params) => {
  if (params.email) validate.email(params.email);

  validate.existence({ argumentValue: program.args[0], argumentName: 'environment', fail: help });

  validate.existence({ argumentValue: params.url, argumentName: 'URL', fail: help });
  validate.url(params.url);
};

const login = async (email, password, url) => {
  return Portal.login(email, password, url)
    .then(response => {
      if (response) return Promise.resolve(response[0].token);
    })
}

program.showHelpAfterError();
program
  .name('pos-cli env add')
  .argument('<environment>', 'name of environment. Example: staging')
  .requiredOption('--email <email>', 'Partner Portal account email. Example: admin@example.com')
  .requiredOption('--url <url>', 'marketplace url. Example: https://example.com')
  .option(
    '--token <token>',
    'if you have a token you can add it directly to pos-cli configuration without connecting to portal'
  )
  .action(async (environment, params) => {
    checkParams(params);
    const settings = { url: params.url, environment: environment, email: params.email };

    if (params.token) {
      token = params.token;
    } else if (!params.email){
      token = await deviceAuthorizationFlow(params.url);
    } else {
      logger.Info(
        `Please make sure that you have a permission to deploy. \n You can verify it here: ${Portal.HOST}/me/permissions`,
        { hideTimestamp: true }
      );

      const password = await readPassword();
      logger.Info(`Asking ${Portal.HOST} for access token...`);

      token = await login(params.email, password, params.url);
    }

    if (token) saveToken(settings, token);
  });

program.parse(process.argv);
