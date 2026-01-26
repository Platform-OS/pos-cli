import { program } from 'commander';
import logger from '../lib/logger.js';
import Portal from '../lib/portal.js';
import { readPassword } from '../lib/utils/password.js';
import { fetchSettings } from '../lib/settings.js';
import { storeEnvironment, deviceAuthorizationFlow } from '../lib/environments.js';
import ServerError from '../lib/ServerError.js';

const saveToken = (settings, token) => {
  storeEnvironment(Object.assign(settings, { token: token }));
  logger.Success(`Environment ${settings.url} as ${settings.environment} has been added successfully.`);
};

const login = async (email, password, url) => {
  return Portal.login(email, password, url)
    .then(response => {
      if (response) return Promise.resolve(response[0].token);
    });
};

program
  .name('pos-cli env refresh-token')
  .arguments('[environment]', 'name of environment. Example: staging')
  .action(async (environment, _params) => {
    try {

      const authData = fetchSettings(environment);

      if (!authData.email){
        token = await deviceAuthorizationFlow(authData.url);
      } else {
        logger.Info(
          `Please make sure that you have a permission to deploy. \n You can verify it here: ${Portal.url()}/me/permissions`,
          { hideTimestamp: true }
        );

        const password = await readPassword();
        logger.Info(`Asking ${Portal.url()} for access token...`);

        token = await login(authData.email, password, authData.url);
      }

      if (token) saveToken({...authData, environment}, token);

    } catch (e) {
      if (ServerError.isNetworkError(e))
        ServerError.handler(e);
      else
        logger.Error(e);
      process.exit(1);
    }

  });

program.parse(process.argv);
