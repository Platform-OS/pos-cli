import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { fetchSettings } from '../lib/settings.js';
import refreshToken from '../lib/envs/refreshToken.js';
import ServerError from '../lib/ServerError.js';

program
  .name('pos-cli env refresh-token')
  .arguments('[environment]', 'name of environment. Example: staging')
  .action(async (environment, _params) => {
    try {
      const authData = await fetchSettings(environment);
      await refreshToken(environment, authData);
    } catch (e) {
      if (ServerError.isNetworkError(e))
        await ServerError.handler(e);
      else
        await logger.Error(e);
      process.exit(1);
    }
  });

program.parse(process.argv);
