import { program } from '../lib/program.js';
import { fetchSettings } from '../lib/settings.js';
import files from '../lib/files.js';
import refreshToken from '../lib/envs/refreshToken.js';
import { reportCommandError } from '../lib/reportCommandError.js';

program
  .name('pos-cli env refresh-token')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option(
    '--otp-code <otpCode>',
    'two-factor code (or a recovery code) for accounts with 2FA enabled. Can also be set as POS_PORTAL_OTP_CODE. Only used by environments that store an email; you are prompted for one when it is missing'
  )
  .action(async (environment, params) => {
    try {
      // A portal environment holds no token of its own: its portal's is the one to renew, and
      // binding first would only fail on the token being renewed.
      const entry = (files.getConfig() || {})[environment];
      if (entry?.portal) {
        throw new Error(`${environment} uses the token of portal ${entry.portal}. Renew that one with: pos-cli portal add ${entry.portal} --force`);
      }
      const authData = await fetchSettings(environment);
      await refreshToken(environment, authData, { otpCode: params.otpCode });
    } catch (e) {
      await reportCommandError(e);
      process.exit(1);
    }
  });

program.parse(process.argv);
