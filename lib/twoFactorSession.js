import files from './files.js';
import { writeFileOwnerOnly } from './filePermissions.js';
import Portal from './portal.js';
import logger from './logger.js';
import { withTwoFactor } from './utils/twoFactor.js';
import { normalizeBaseUrl as normalize } from './utils/url.js';
import { reportCommandError } from './reportCommandError.js';

// The field a session is stored under, inside the environment's entry in .pos. Snake case
// to match the neighbours (url, token, email, partner_portal_url).
const SESSION_FIELD = 'two_factor_session';

// An already-minted session, for a caller that has one and no way to be prompted: a CI job
// handed one by whatever orchestrator did the step-up, or a test. Read-only — pos-cli never
// writes it, because a child process cannot export back to the shell that ran it and
// printing a live credential to stdout would put it in the job log.
const SESSION_TOKEN_ENV_VAR = 'POS_PORTAL_SESSION_TOKEN';

// Settings do not always have a .pos behind them: MPKIT_URL/EMAIL/TOKEN take precedence
// over the file (see settings.js) and CI commonly sets only those. A session started in
// that mode has nowhere on disk to live, so it lives here for the life of the process —
// which is what stops a `sync` running for hours from prompting once per changed file.
const inMemory = new Map();

// Finds the .pos entry a set of settings came from, matched on the instance URL rather
// than on the environment name: the name does not survive every path settings take, since
// watch.js, push.js and the GUI server rebuild them from MARKETPLACE_* variables that
// carry the URL and nothing else.
const findEnvironment = (instanceUrl, portalUrl) => {
  const config = files.getConfig() || {};
  const url = normalize(instanceUrl);
  const matches = Object.keys(config).filter(name => normalize(config[name]?.url) === url);
  if (!matches.length) return null;

  // One URL can appear under two environments while a domain is moved between portals —
  // which is exactly what the `dns` commands do — and a session proved to one portal is
  // not a credential for the other. Prefer the entry whose portal the caller named.
  const samePortal = portalUrl &&
    matches.find(name => normalize(config[name].partner_portal_url) === normalize(portalUrl));

  return { config, name: samePortal || matches[0] };
};

// A minute of slack so a session cannot expire midway through a deploy that just passed
// this check. A session with no expiry at all is one the caller injected: its lifetime is
// unknown here, so it is trusted and the instance is left to reject it if it is stale.
const EXPIRY_MARGIN_MS = 60 * 1000;

const isSessionLive = (session) => {
  if (!session || !session.token) return false;
  if (!session.expires_at) return true;

  const expiresAt = Date.parse(session.expires_at);
  return !Number.isNaN(expiresAt) && expiresAt - EXPIRY_MARGIN_MS > Date.now();
};

// How much longer a session has, in words, read off the expiry the Portal reported.
//
// The lifetime is the Portal's to choose — it stamps expires_at when it mints the session
// — and it has been changed before, so pos-cli never states it as a constant of its own:
// every duration it prints about a session comes back through here. Rounded to whole
// minutes or hours, because this only ever feeds a sentence telling an operator roughly
// how long they have.
const describeLifetime = (expiresAt) => {
  const expires = Date.parse(expiresAt ?? '');
  if (Number.isNaN(expires)) return null;

  const minutes = Math.round((expires - Date.now()) / 60_000);
  if (minutes < 1) return 'less than a minute';
  if (minutes < 120) return `${minutes} minute${minutes === 1 ? '' : 's'}`;

  return `${Math.round(minutes / 60)} hours`;
};

/**
 * What a long-running command says when the instance stops accepting its requests for want
 * of a two-factor session, in place of stepping up where it stands.
 *
 * Every short command steps up in place, and should: it is one request, the prompt is the
 * only thing on screen, and the operator is sitting in front of it. Watch mode is none of
 * those — CONCURRENCY uploads are in flight and get refused together, file events keep
 * arriving behind them, and the run may have been left alone for hours. A prompt raised
 * into that interleaves with the `[Sync] Synced:` lines and blocks a queue that keeps
 * filling. So it stops and asks to be restarted instead: a restart mints the session up
 * front, before the watcher and before any spinner, which is where the prompt belongs.
 */
const sessionInterruptedMessage = ({ command, expired = true }) =>
  (expired
    ? 'Your two-factor session has expired, so the instance stopped accepting changes.'
    : 'This instance requires a two-factor session and this run has not got one.') +
  '\nAny change that has just been reported as failed did not reach the instance.' +
  `\nRun \`${command}\` again — it asks for a code once, before watching starts.` +
  '\nThen re-save the files you changed in the meantime: sync only sends a file when it changes.';

const readSession = (instanceUrl, portalUrl) => {
  const injected = process.env[SESSION_TOKEN_ENV_VAR];
  if (injected) return { token: injected };

  // The in-memory copy is consulted even when a .pos entry matched: persistSession falls
  // back to memory whenever the write fails (a read-only checkout, a file owned by another
  // account), and looking only at the entry would make that fallback unreachable — every
  // Gateway built afterwards would prompt again for a session this process already holds.
  const found = findEnvironment(instanceUrl, portalUrl);
  const stored = (found && found.config[found.name][SESSION_FIELD]) || inMemory.get(normalize(instanceUrl));

  return isSessionLive(stored) ? stored : null;
};

// Stores a session against the environment it belongs to, or removes it when `session` is
// null. Both directions are the same read-modify-write, so they share one.
//
// Rewrites the whole file from the object just read, so every other environment and every
// field pos-cli does not know about survives — .pos is hand-edited, and storeEnvironment's
// rebuild-from-known-keys would drop anything it had not heard of.
//
// Written through writeFileOwnerOnly, like every other writer of .pos: the file holds a
// long-lived token already, and now a session too.
const persistSession = (instanceUrl, portalUrl, session) => {
  const found = findEnvironment(instanceUrl, portalUrl);
  if (!found) {
    if (session) inMemory.set(normalize(instanceUrl), session);
    else inMemory.delete(normalize(instanceUrl));
    return;
  }

  try {
    const configPath = files.getConfigPath(process.env.CONFIG_FILE_PATH);
    const config = found.config;
    if (session) config[found.name] = { ...config[found.name], [SESSION_FIELD]: session };
    else delete config[found.name][SESSION_FIELD];

    writeFileOwnerOnly(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    // Losing the cache costs a prompt on the next command, which is not worth failing for
    // — but the session just minted is still good for this process.
    logger.Debug(`[twoFactorSession] Could not persist session: ${error.message}`);
    if (session) inMemory.set(normalize(instanceUrl), session);
  }
};

const clearSession = (instanceUrl, portalUrl) => {
  inMemory.delete(normalize(instanceUrl));
  persistSession(instanceUrl, portalUrl, null);
};

// The portal an instance was registered against, for a caller that was handed a URL and a
// token and nothing else. Same lookup as the session itself, so a private-stack instance
// steps up against its own portal without PARTNER_PORTAL_HOST having to be threaded
// through every process boundary.
const portalUrlFor = (instanceUrl) => {
  const found = findEnvironment(instanceUrl);
  return found ? found.config[found.name].partner_portal_url : undefined;
};

/**
 * What is said the moment a code is asked for.
 *
 * Two-factor authentication is a property of the Partner Portal account whose token is
 * being presented, not of the instance: the instance only insists that whoever holds the
 * token has proved it. Saying "this instance requires a two-factor code" sent operators
 * looking for a per-instance setting that does not exist, and left a shared instance
 * looking like the thing that had changed when it was their own account that had.
 *
 * The instance, the portal and the account are named because none of them is on the
 * command line — `pos-cli deploy staging` names neither host — and a code is worth
 * confirming the target of before typing it. The portal and the account answer the other
 * half of the question: an operator with an account on a private stack as well as on
 * partners.platformos.com has two authenticator entries and nothing else here to tell
 * which one this prompt wants.
 *
 * The email is whatever `.pos` holds for the environment (or MPKIT_EMAIL), which is the
 * address pos-cli already sends as `From:` on every request. Environments added through
 * the browser device flow store none, so the line is simply left out rather than guessed
 * at: the Portal is not asked who the token belongs to just to label a prompt.
 */
const sessionPrelude = ({ instanceUrl, portalUrl, email }) =>
  `Your Partner Portal account${email ? ` (${email})` : ''} has 2FA enabled.` +
  `\n  Instance: ${normalize(instanceUrl)}` +
  `\n  Portal:   ${normalize(portalUrl || Portal.url())}`;

// Prompts for a code and trades it with the Portal for a session token. withTwoFactor does
// the prompting, the retries and the lockout handling: the step-up endpoint answers with
// the same two_factor_required / _invalid / _locked bodies as every other Portal endpoint
// that can refuse a code.
const mintSession = async ({ portalUrl, instanceUrl, token, email, otpCode, interactive }) => {
  const response = await withTwoFactor(
    code => Portal.twoFactorSession({ portalUrl, token, instanceDomain: instanceUrl, otpCode: code }),
    {
      otpCode,
      interactive,
      prelude: sessionPrelude({ instanceUrl, portalUrl, email }),
      // Not the usual "use a long-lived token" advice: a long-lived token is precisely
      // what this instance has just refused, so pointing at one would send the operator
      // in a circle.
      //
      // Deliberately carries no duration. The lifetime is the Portal's and is not knowable
      // at this point — nothing has been minted yet, and the token-info response says
      // nothing about a session that does not exist. It is reported below instead, off the
      // real session's expires_at, so no number pos-cli prints can drift from the Portal.
      unattendedHint:
        '\nA session is short-lived, so an unattended run needs a fresh code once it expires; ' +
        `a recovery code works and does not expire on a timer, and ${SESSION_TOKEN_ENV_VAR} accepts a session ` +
        'that was minted elsewhere.'
    }
  );

  if (!response || !response.token) {
    throw new Error(`${normalize(portalUrl)} did not return a two-factor session token.`);
  }

  const session = { token: response.token, expires_at: response.expires_at };
  persistSession(instanceUrl, portalUrl, session);

  // Said out loud rather than only at Debug: this lands immediately after the operator
  // typed a code, the one moment when knowing how long it bought them is worth a line —
  // and it is the only place the lifetime is stated, so it cannot contradict the Portal.
  const lifetime = describeLifetime(session.expires_at);
  if (lifetime) await logger.Info(`Two-factor session started — it expires in ${lifetime}.`, { hideTimestamp: true });

  logger.Debug(`[twoFactorSession] Session stored, expires ${session.expires_at}`);
  return session;
};

// A step-up in progress, per instance. sync runs its queue at CONCURRENCY (3 by default),
// so an instance that wants a session refuses that many uploads at once — and without this
// each one would open its own readline over the same stdin and mint its own session. The
// first caller prompts; the rest wait on its answer. Same shape as watch.js's shared
// refreshDirectUploadData promise, for the same reason.
const inFlight = new Map();

const startSession = (args) => {
  const key = normalize(args.instanceUrl);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = mintSession(args).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
};

/**
 * Makes sure a two-factor session exists before a command that needs one starts working.
 *
 * Every command reaches the instance through Gateway, which steps up on demand, so this is
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
const ensureSession = async ({ portalUrl, instanceUrl, token, email, otpCode, interactive }) => {
  const existing = readSession(instanceUrl, portalUrl);
  if (existing) {
    logger.Debug('[twoFactorSession] Reusing a stored session');
    return existing;
  }

  let info;
  try {
    info = await Portal.tokenInfo({ portalUrl, token });
  } catch (error) {
    // A Portal that cannot answer is not a reason to refuse to deploy: the instance is the
    // side that actually enforces this, and it will ask for a session if it wants one.
    logger.Debug(`[twoFactorSession] Could not read token info: ${error.message}`);
    return null;
  }

  if (!info || !info.two_factor_required || info.two_factor_session) return null;

  return startSession({ portalUrl, instanceUrl, token, email, otpCode, interactive });
};

/**
 * The `deploy`/`sync`/`gui serve` front door for ensureSession: same call, plus the
 * reporting policy all three commands need.
 *
 * Nothing escapes. All three callers `await` this at the top of a commander action, and
 * every one of those bins ends in `program.parse` rather than `parseAsync`, so commander
 * never sees the rejection: an error thrown from here arrives as a Node unhandled
 * rejection and prints a stack trace where a message belongs. reportCommandError already
 * knows the three cases apart — a TwoFactorError carries its own multi-line actionable
 * text, a Portal that answers 5xx or refuses the connection goes to ServerError, and
 * anything else is named by the prefix — and each of them exits 1, which is what the
 * unhandled rejection did anyway, only legibly.
 */
const ensureSessionForCommand = async (authData, { otpCode } = {}) => {
  try {
    await ensureSession({
      portalUrl: authData.partner_portal_url,
      instanceUrl: authData.url,
      token: authData.token,
      email: authData.email,
      otpCode
    });
  } catch (error) {
    await reportCommandError(error, { prefix: 'Could not start a two-factor session' });
  }
};

export {
  SESSION_TOKEN_ENV_VAR,
  describeLifetime,
  isSessionLive,
  ensureSession,
  sessionPrelude,
  ensureSessionForCommand,
  clearSession,
  portalUrlFor,
  readSession,
  sessionInterruptedMessage,
  startSession
};
