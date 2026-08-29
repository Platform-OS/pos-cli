import Portal from '../portal.js';
import logger from '../logger.js';
import { readPassword } from '../utils/password.js';
import { storeEnvironment, deviceAuthorizationFlow } from '../environments.js';
import { withTwoFactor } from '../utils/twoFactor.js';

const login = async (email, password, url, otpCode) => {
  return Portal.login(email, password, url, otpCode)
    .then(response => {
      if (response) return Promise.resolve(response[0].token);
    });
};

const refreshToken = async (environment, authData, { otpCode } = {}) => {
  let token;

  if (!authData.email) {
    token = await deviceAuthorizationFlow(authData.url);
  } else {
    logger.Info(
      `Please make sure that you have a permission to deploy. \n You can verify it here: ${Portal.url()}/me/permissions`,
      { hideTimestamp: true }
    );

    const password = await readPassword();
    logger.Info(`Asking ${Portal.url()} for access token...`);

    token = await withTwoFactor(
      code => login(authData.email, password, authData.url, code),
      { otpCode }
    );
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
