import Portal from '../portal.js';
import logger from '../logger.js';
import { readPassword } from '../utils/password.js';
import { withTwoFactor } from '../utils/twoFactor.js';

/**
 * Mints a long-lived Partner Portal token from an email and password.
 *
 * Shared by `env add` and `env refresh-token`, which want the same thing and differ only
 * in what they do with the token afterwards — keeping one copy is what stops the two
 * commands drifting in how they authenticate.
 *
 * The token this mints is good for a year against every instance the user can deploy to,
 * so the portal asks a 2FA account for its second factor before issuing one; withTwoFactor
 * does the prompting and the retries.
 *
 * @param {{ email: string, url: string, otpCode?: string }} params
 * @returns {Promise<string|undefined>} the token, or undefined when the portal returned none
 */
const passwordLogin = async ({ email, url, otpCode }) => {
  logger.Info(
    `Please make sure that you have a permission to deploy. \n You can verify it here: ${Portal.url()}/me/permissions`,
    { hideTimestamp: true }
  );

  const password = await readPassword();
  logger.Info(`Asking ${Portal.url()} for access token...`);

  return withTwoFactor(
    code => Portal.login(email, password, url, code).then(response => (response ? response[0].token : undefined)),
    { otpCode }
  );
};

export { passwordLogin };
