import { program } from '../lib/program.js';
import { fetchSettings } from '../lib/settings.js';
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
      const authData = await fetchSettings(environment);
      await refreshToken(environment, authData, { otpCode: params.otpCode });
    } catch (e) {
      await reportCommandError(e);
      process.exit(1);
    }
  });

program.parse(process.argv);
