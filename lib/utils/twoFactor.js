import rl from 'readline';
import logger from '../logger.js';
import { pauseActiveSpinners } from '../ora.js';

// The Partner Portal names a two-factor failure in the 401 body (its TwoFactorApiResponse
// concern) precisely so a client can pick its next move instead of reporting the password
// as wrong. Every other failure -- a wrong password above all -- stays a bodiless 401.
const TWO_FACTOR_REQUIRED = 'two_factor_required'; // no code was sent
const TWO_FACTOR_INVALID = 'two_factor_invalid';   // wrong code, attempts left
const TWO_FACTOR_LOCKED = 'two_factor_locked';     // budget spent, retrying is pointless

const OTP_CODE_ENV_VAR = 'POS_PORTAL_OTP_CODE';

// The portal locks an account for 15 minutes after 5 wrong codes
// (User::OTP_MAX_FAILED_ATTEMPTS / OTP_LOCK_DURATION). That counter lives on the user row
// and is shared with every other surface, the web UI included, so stopping at 3 leaves the
// operator attempts to spend elsewhere rather than locking them out of the portal over a
// mistyped digit here.
const MAX_ATTEMPTS = 3;

class TwoFactorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TwoFactorError';
  }
}

const errorCode = (error) => {
  if (!error || error.statusCode !== 401) return null;
  const body = error.response?.body;
  return body && typeof body === 'object' ? body.error : null;
};

const isTwoFactorRequired = (error) => errorCode(error) === TWO_FACTOR_REQUIRED;
const isTwoFactorInvalid = (error) => errorCode(error) === TWO_FACTOR_INVALID;
const isTwoFactorLocked = (error) => errorCode(error) === TWO_FACTOR_LOCKED;

const isUnauthorized = (error) => !!error && error.statusCode === 401;

// Portals older than the two_factor_invalid/two_factor_locked codes answer a wrong code
// with a bodiless 401, which is also what a wrong password looks like. pos-cli talks to
// private-stack deployments that upgrade on their own schedule, so the old inference has
// to stay: a code we sent ourselves can only have been refused for being wrong, because
// the portal would not have asked for one at all unless the password had passed.
const isRejectedCode = (error, codeWasSent) =>
  codeWasSent && (isTwoFactorInvalid(error) || (isUnauthorized(error) && !errorCode(error)));

// Authenticator apps display codes in groups ("123 456") and recovery codes get pasted
// with stray whitespace. The portal compares the string it is handed, so normalize here.
const normalizeCode = (code) => String(code ?? '').replace(/\s+/g, '');

const presetCode = (otpCode) => normalizeCode(otpCode || process.env[OTP_CODE_ENV_VAR] || '') || null;

const OTP_PROMPT = 'Two-factor code (or a recovery code): ';

// One readline interface serves every attempt of a retry loop. Creating a fresh one per
// prompt does not work: an interface built over process.stdin after an earlier one was
// closed fires 'close' immediately instead of reading, so the second prompt would abort
// rather than ask -- exactly the case a user hits after mistyping their first code.
//
// The prompt deliberately echoes, unlike the password one: a TOTP code is single-use and
// expires in 30 seconds, and seeing the digits is what lets an operator catch a typo
// before it costs one of the five attempts the portal allows.
const createOtpPrompt = () => {
  const reader = rl.createInterface({ input: process.stdin, output: process.stdout });
  let closed = false;
  let pending = null;

  // A stdin that ends while a prompt is up fires 'close' and never calls the question
  // callback; resolving null there is what keeps the loop from hanging forever.
  reader.on('close', () => {
    closed = true;
    const resolve = pending;
    pending = null;
    if (resolve) resolve(null);
  });

  return {
    ask: () => new Promise(resolve => {
      if (closed) return resolve(null);

      pending = resolve;
      reader.question(OTP_PROMPT, code => {
        pending = null;
        logger.Log('');
        resolve(normalizeCode(code));
      });
    }),
    close: () => reader.close()
  };
};

const sourceOfPreset = (otpCode) => (otpCode ? '--otp-code' : OTP_CODE_ENV_VAR);

// The right unattended advice differs by caller, and getting it wrong is worse than
// giving none: a long-lived token is the answer when the code is gating a *login*, and
// exactly the wrong answer when it is gating a deploy, which such a token can no longer do.
const PASSWORD_PRELUDE =
  'This account has two-factor authentication enabled. Your password was accepted.';

const TOKEN_HINT =
  '\nFor unattended use prefer a long-lived token: `pos-cli env add <environment> --url <url> --token <token>` needs no password and no code.';

const nonInteractiveMessage = (rejectedPreset, otpCode, unattendedHint = TOKEN_HINT) =>
  (rejectedPreset
    ? `The two-factor code supplied via ${sourceOfPreset(otpCode)} was rejected by the Partner Portal.` +
      '\nA TOTP code is only valid for about 30 seconds — generate a fresh one, or use one of your recovery codes.'
    : 'This Partner Portal account has two-factor authentication enabled, and there is no terminal to prompt for a code on.' +
      `\nPass --otp-code <code>, set ${OTP_CODE_ENV_VAR}, or run the command in an interactive terminal.`) +
  unattendedHint;

const attemptsLeftWarning = (attempts) =>
  `That code was not accepted (attempt ${attempts} of ${MAX_ATTEMPTS}).`;

const exhaustedMessage = () =>
  `Two-factor authentication failed ${MAX_ATTEMPTS} times, so pos-cli stopped trying.` +
  '\nThe Partner Portal locks an account for 15 minutes after 5 wrong codes — the remaining attempts are left for you to spend deliberately.' +
  '\nCheck that your authenticator app clock is in sync, or use one of the recovery codes you saved when you enabled 2FA.';

// The portal has told us the budget is already spent, so every further code would be
// refused unread. Stopping here also stops the hammering that keeps the lock alive.
const lockedMessage = () =>
  'Too many two-factor attempts — the Partner Portal has locked this account for 15 minutes.' +
  '\nFurther codes are refused unread until the lock expires, so pos-cli stopped rather than retrying.';

/**
 * Runs a portal request that authenticates with an email and password, supplying a
 * second factor when the portal asks for one.
 *
 * `run` is called with the code to send (null when there is none) and must reject with
 * the error apiRequest throws, so the 401 body can be read.
 *
 * @param {(code: string|null) => Promise<any>} run
 * @param {{ otpCode?: string, interactive?: boolean, unattendedHint?: string, prelude?: string }} options
 * @returns {Promise<any>} whatever `run` resolves to
 */
const withTwoFactor = async (run, { otpCode, interactive, unattendedHint, prelude = PASSWORD_PRELUDE } = {}) => {
  const preset = presetCode(otpCode);

  let failure;
  try {
    return await run(preset);
  } catch (error) {
    failure = error;
  }

  // Retrying a locked account only refreshes the reason it is locked, so stop at once —
  // whether the lock was already there or the preset code just earned it.
  if (isTwoFactorLocked(failure)) throw new TwoFactorError(lockedMessage());

  // Without this a wrong --otp-code would surface as the generic "check if your
  // email/password are correct", since a rejected code is a 401 like any other.
  const rejectedPreset = isRejectedCode(failure, Boolean(preset));
  if (!isTwoFactorRequired(failure) && !rejectedPreset) throw failure;

  const canPrompt = interactive ?? Boolean(process.stdin.isTTY);
  if (!canPrompt) throw new TwoFactorError(nonInteractiveMessage(rejectedPreset, otpCode, unattendedHint));

  if (rejectedPreset) {
    await logger.Warn(`The two-factor code supplied via ${sourceOfPreset(otpCode)} was not accepted.`);
  } else {
    // Reaching here means the primary credential was accepted and only the second factor
    // is outstanding, which is worth saying: otherwise a prompt appearing after a password
    // reads as "that password was wrong, try again".
    await logger.Info(prelude, { hideTimestamp: true });
  }

  // A deploy or sync is mid-spinner when the Instance asks for a second factor, and a
  // spinner repaints over anything else on the line -- the prompt included, which made it
  // look like the command had hung with no explanation.
  const resumeSpinners = pauseActiveSpinners();
  const prompt = createOtpPrompt();
  try {
    let attempts = 0;
    while (attempts < MAX_ATTEMPTS) {
      const code = await prompt.ask();
      if (code === null) throw new TwoFactorError(nonInteractiveMessage(false, otpCode, unattendedHint));
      if (!code) {
        await logger.Warn('No code entered — press Ctrl+C to abort.');
        continue;
      }

      attempts += 1;
      try {
        return await run(code);
      } catch (error) {
        // Anything that is not a 401 (a 500, a network drop) is the caller's problem, not
        // a wrong code — do not burn attempts on it.
        if (!isUnauthorized(error)) throw error;
        if (isTwoFactorLocked(error)) throw new TwoFactorError(lockedMessage());
        if (attempts < MAX_ATTEMPTS) await logger.Warn(attemptsLeftWarning(attempts));
      }
    }

    throw new TwoFactorError(exhaustedMessage());
  } finally {
    prompt.close();
    resumeSpinners();
  }
};

export {
  MAX_ATTEMPTS,
  TOKEN_HINT,
  OTP_CODE_ENV_VAR,
  TwoFactorError,
  isTwoFactorInvalid,
  isTwoFactorLocked,
  isTwoFactorRequired,
  normalizeCode,
  withTwoFactor
};
