import fs from 'fs';
import os from 'os';
import path from 'path';
import Portal from './portal.js';
import logger from './logger.js';
import { withTwoFactor } from './utils/twoFactor.js';

// What an Instance answers a write with when the credential presented has not proved a
// second factor and the Partner Portal says its holder must (see the Instance's
// Api::AppBuilder::BaseController#require_two_factor_session).
const TWO_FACTOR_REQUIRED = 'two_factor_required';

// Sessions are credentials, not configuration, so they are kept out of .pos — which lives
// in the repository and is routinely shared — and in the user's home directory with
// owner-only permissions.
const SESSION_DIR = () => path.join(os.homedir(), '.pos-cli');
const SESSION_FILE = () => path.join(SESSION_DIR(), 'sessions.json');

// A session belongs to one instance on one portal: the same instance URL served by a
// different portal is a different credential entirely.
const sessionKey = (portalUrl, instanceUrl) => `${normalize(portalUrl)}|${normalize(instanceUrl)}`;

const normalize = (url) => String(url || '').replace(/\/+$/, '');

const readStore = () => {
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE(), 'utf8'));
  } catch {
    // A missing, unreadable or corrupt store just means "no session" — never a hard
    // failure, since the remedy is always to prompt for a code again.
    return {};
  }
};

const writeStore = (store) => {
  try {
    fs.mkdirSync(SESSION_DIR(), { recursive: true, mode: 0o700 });
    // mkdir's mode is masked by umask (usually 022, giving 755), so it is set again here:
    // the directory listing alone tells an onlooker which portals and instances this
    // machine holds live deploy sessions for.
    fs.chmodSync(SESSION_DIR(), 0o700);
    fs.writeFileSync(SESSION_FILE(), JSON.stringify(store, null, 2), { mode: 0o600 });
  } catch (error) {
    // Losing the cache costs a prompt on the next command, which is not worth failing for.
    logger.Debug(`[twoFactorSession] Could not persist session: ${error.message}`);
  }
};

// Expired entries are dropped on read rather than returned for the server to reject:
// re-prompting up front is what "enforce when the command starts" means. A minute of slack
// keeps a session from expiring midway through a deploy that just passed this check.
const EXPIRY_MARGIN_MS = 60 * 1000;

// Only for the message below — the Portal decides the real lifetime and reports it as
// expires_at, which is what the store actually honours.
const SESSION_HOURS = 8;

const readSession = (portalUrl, instanceUrl) => {
  const entry = readStore()[sessionKey(portalUrl, instanceUrl)];
  if (!entry || !entry.token) return null;

  const expiresAt = Date.parse(entry.expiresAt);
  if (Number.isNaN(expiresAt) || expiresAt - EXPIRY_MARGIN_MS <= Date.now()) return null;

  return entry;
};

const writeSession = (portalUrl, instanceUrl, session) => {
  const store = readStore();
  store[sessionKey(portalUrl, instanceUrl)] = session;
  writeStore(store);
};

const clearSession = (portalUrl, instanceUrl) => {
  const store = readStore();
  delete store[sessionKey(portalUrl, instanceUrl)];
  writeStore(store);
};

const needsTwoFactorSession = (error) => {
  if (!error || error.statusCode !== 401) return false;
  const body = error.response?.body;
  return !!body && typeof body === 'object' && body.error === TWO_FACTOR_REQUIRED;
};

// Prompts for a code and trades it with the Portal for a session token. withTwoFactor does
// the prompting, the retries and the lockout handling: the step-up endpoint answers with
// the same two_factor_required / _invalid / _locked bodies as every other Portal endpoint
// that can refuse a code, which is the whole point of them being one vocabulary.
const startSession = async ({ portalUrl, instanceUrl, token, otpCode, interactive }) => {
  const response = await withTwoFactor(
    code => Portal.twoFactorSession({ portalUrl, token, instanceDomain: instanceUrl, otpCode: code }),
    {
      otpCode,
      interactive,
      prelude: 'This instance requires a two-factor code.',
      // Not the usual "use a long-lived token" advice: a long-lived token is precisely
      // what this instance has just refused, so pointing at one would send the operator
      // in a circle.
      unattendedHint:
        `\nA session lasts ${SESSION_HOURS} hours, so an unattended run needs a code at the start of each one; ` +
        'a recovery code works and does not expire on a timer.'
    }
  );

  if (!response || !response.token) {
    throw new Error(`${normalize(portalUrl)} did not return a two-factor session token.`);
  }

  const session = { token: response.token, expiresAt: response.expires_at };
  writeSession(portalUrl, instanceUrl, session);
  logger.Debug(`[twoFactorSession] Session stored, expires ${session.expiresAt}`);
  return session;
};

/**
 * Makes sure a two-factor session exists before a command that needs one starts working.
 *
 * Every command reaches the Instance through Gateway, which steps up on demand, so this is
 * not what makes the rule hold — it is what makes the prompt land at a sensible moment for
 * the two long-running commands.
 *
 * Called at the top of `deploy` and `sync`, deliberately before any spinner is up: a
 * spinner repaints its line on a timer, so a prompt raised underneath one is painted over
 * and the command looks like it has hung. It also means the operator is asked once, up
 * front, rather than partway through an upload.
 *
 * Returns null when no session is needed — the account is not enrolled, or its Partner
 * does not require one — in which case the long-lived token keeps working as before.
 */
const ensureSession = async ({ portalUrl, instanceUrl, token, otpCode, interactive }) => {
  const existing = readSession(portalUrl, instanceUrl);
  if (existing) {
    logger.Debug('[twoFactorSession] Reusing a stored session');
    return existing;
  }

  let info;
  try {
    info = await Portal.tokenInfo({ portalUrl, token });
  } catch (error) {
    // A Portal that cannot answer is not a reason to refuse to deploy: the Instance is the
    // side that actually enforces this, and it will ask for a session if it wants one.
    logger.Debug(`[twoFactorSession] Could not read token info: ${error.message}`);
    return null;
  }

  if (!info || !info.two_factor_required || info.two_factor_session) return null;

  return startSession({ portalUrl, instanceUrl, token, otpCode, interactive });
};

export {
  TWO_FACTOR_REQUIRED,
  ensureSession,
  clearSession,
  needsTwoFactorSession,
  readSession,
  sessionKey,
  startSession
};
