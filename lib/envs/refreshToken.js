import logger from '../logger.js';
import { storeEnvironment, deviceAuthorizationFlow } from '../environments.js';
import { passwordLogin } from './passwordLogin.js';

const refreshToken = async (environment, authData, { otpCode } = {}) => {
  let token;

  if (!authData.email) {
    token = await deviceAuthorizationFlow(authData.url);
  } else {
    token = await passwordLogin({ email: authData.email, url: authData.url, otpCode });
  }

  if (token) {
    storeEnvironment({ ...authData, environment, token });
    logger.Success(`Token for ${authData.url} as ${environment} has been refreshed successfully.`);
  } else {
    logger.Warn('Could not obtain a new token. Your existing token has not been changed.');
  }

  return token;
};

export default refreshToken;
