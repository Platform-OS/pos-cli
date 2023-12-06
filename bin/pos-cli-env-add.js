#!/usr/bin/env node

const program = require('commander');
const logger = require('../lib/logger');
const validate = require('../lib/validators');
const Portal = require('../lib/portal');
const waitForStatus = require('../lib/data/waitForStatus');
const { readPassword } = require('../lib/utils/password');
const { storeEnvironment, deviceAuthorizationFlow } = require('../lib/environments');
const ServerError = require('../lib/ServerError');

const saveToken = (settings, token) => {
  storeEnvironment(Object.assign(settings, { token: token }));
  logger.Success(`Environment ${settings.url} as ${settings.environment} has been added successfuly.`);
};

const help = () => {
  program.outputHelp();
  process.exit(1);
}

const checkParams = params => {
  // validate.existence({ argumentValue: params.email, argumentName: 'email', fail: help });
  if (params.email) validate.email(params.email);

  validate.existence({ argumentValue: program.args[0], argumentName: 'environment', fail: help });

  validate.existence({ argumentValue: params.url, argumentName: 'URL', fail: help });
  if (params.url.slice(-1) != '/') {
    params.url = params.url + '/';
  }
  validate.url(params.url);
};


const login = async (email, password, url) => {
  return Portal.login(email, password, url)
    .then(response => {
      if (response) return Promise.resolve(response[0].token);
    })
}

program
  .name('pos-cli env add')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--email <email>', 'Partner Portal account email. Example: admin@example.com')
  .option('--url <url>', 'marketplace url. Example: https://example.com')
  .option(
    '--token <token>',
    'if you have a token you can add it directly to pos-cli configuration without connecting to portal'
  )
  .action(async (environment, params) => {
    try {
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
    } catch (e) {
      if (ServerError.isNetworkError(e))
        ServerError.handler(e)
      else
        logger.Error('Error');
      process.exit(1);
    }
  });

program.parse(process.argv);
