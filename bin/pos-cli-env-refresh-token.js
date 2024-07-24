const { program } = require('commander');
const logger = require('../lib/logger');
const Portal = require('../lib/portal');
const { readPassword } = require('../lib/utils/password');
const fetchAuthData = require('../lib/settings').fetchSettings;
const { storeEnvironment, deviceAuthorizationFlow } = require('../lib/environments');
const ServerError = require('../lib/ServerError');

const saveToken = (settings, token) => {
  storeEnvironment(Object.assign(settings, { token: token }));
  logger.Success(`Environment ${settings.url} as ${settings.environment} has been added successfuly.`);
};

const login = async (email, password, url) => {
  return Portal.login(email, password, url)
    .then(response => {
      if (response) return Promise.resolve(response[0].token);
    })
}

program
  .name('pos-cli env refresh-token')
  .arguments('[environment]', 'name of environment. Example: staging')
  .action(async (environment, params) => {
    try {

      const authData = fetchAuthData(environment)

      if (!authData.email){
        token = await deviceAuthorizationFlow(authData.url);
      } else {
        logger.Info(
          `Please make sure that you have a permission to deploy. \n You can verify it here: ${Portal.HOST}/me/permissions`,
          { hideTimestamp: true }
        );

        const password = await readPassword();
        logger.Info(`Asking ${Portal.HOST} for access token...`);

        token = await login(authData.email, password, authData.url);
      }

      if (token) saveToken({...authData, environment}, token);

    } catch (e) {
      if (ServerError.isNetworkError(e))
        ServerError.handler(e)
      else
        logger.Error(e);
      process.exit(1);
    }

  });

program.parse(process.argv);
