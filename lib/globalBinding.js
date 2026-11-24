import crypto from 'crypto';
import Portal from './portal.js';
import logger from './logger.js';
import files from './files.js';
import { writeFileOwnerOnly } from './filePermissions.js';
import { getPortal, readPortals, updatePortal } from './portals.js';
import { ensureSession } from './twoFactorSession.js';
import { getNetworkErrorCode } from './ServerError.js';
import { isPortalOutage, retryAfterSeconds } from './utils/partnerPortal.js';
import { isTokenRefusal, tokenRefusalMessage } from './utils/tokenScopes.js';
import sleep from './utils/sleep.js';

/**
 * A Partner Portal global token reaches many instances, and an instance runs tenant-authored
 * code: one sent the token itself could replay it at every other instance it reaches. So it
 * is never sent to an instance. Before a command talks to one, the global token is traded at
 * the Portal for a token bound to that instance alone (POST /api/global_token/bind), and that
 * is what the command -- and every process it starts -- uses. Instances refuse the global
 * token itself.
 *
 * Applies to an environment that names a portal (`env add --portal`), and to any other global
 * token -- pasted with `env add --token`, or in MPKIT_TOKEN -- which the Portal issues with
 * GLOBAL_TOKEN_PREFIX, so no request is needed to tell. A per-instance token from `env add` is
 * used as it is.
 *
 * A bound token is kept until shortly before it expires: on the portal for a portal
 * environment, on the .pos entry otherwise, in memory for MPKIT_*.
 */

const EXPIRY_MARGIN_MS = 5 * 60 * 1000;
// Attempts at a bind while the Portal is not answering, as Gateway#requestWaitingForPortal
// makes at an instance that cannot reach it: up to about two minutes, then the error.
const BIND_ATTEMPTS = 5;
const GLOBAL_TOKEN_PREFIX = 'posg_';
const inMemory = new Map();
// Bound tokens this process obtained from the Portal itself, rather than read from a cache.
// An instance refusing one of these outright is not a token that ended: the Portal issued it
// for that instance moments ago, so the instance cannot accept global tokens at all -- its
// platformOS release predates them (Gateway#boundTokenEnded says so).
const boundThisRun = new Set();

const rememberBoundThisRun = (token) => boundThisRun.add(token);
const isBoundThisRun = (token) => boundThisRun.has(token);

const isGlobalToken = (token) => String(token || '').startsWith(GLOBAL_TOKEN_PREFIX);

// Which session a bound token was bound from (a digest, never the session itself). Kept for
// diagnosis only: a bound token never outlives the session it was bound from (the Portal caps
// its lifetime at the session's), so a live bound token is usable whatever session is stored now.
const sessionMark = (session) => (session?.token ? crypto.createHash('sha256').update(session.token).digest('hex') : null);

const live = (bound) => bound?.token && bound.expires_at && Date.parse(bound.expires_at) - EXPIRY_MARGIN_MS > Date.now();

const hostOf = (url) => new URL(url).hostname.toLowerCase();

// The global token behind a set of settings, and where its bound tokens are kept -- or null
// when the settings carry no global token.
const globalSource = (settings, environment) => {
  if (settings.portal) {
    const portal = getPortal(settings.portal);
    return portal && { root: portal.token, portalUrl: portal.url, store: 'portal' };
  }
  if (!isGlobalToken(settings.token)) return null;

  const portalUrl = settings.partner_portal_url || Portal.url();
  return settings.fromEnv || !environment
    ? { root: settings.token, portalUrl, store: 'memory' }
    : { root: settings.token, portalUrl, store: 'dotPos', environment };
};

const readBound = (source, settings, host) => {
  if (source.store === 'portal') return getPortal(settings.portal)?.bound_tokens?.[host];
  if (source.store === 'dotPos') return (files.getConfig() || {})[source.environment]?.bound_tokens?.[host];
  return inMemory.get(`${source.root} ${host}`);
};

const keepBound = (source, settings, host, bound) => {
  try {
    if (source.store === 'portal') {
      updatePortal(settings.portal, (portal) => ({ ...portal, bound_tokens: { ...pruned(portal.bound_tokens), [host]: bound } }));
    } else if (source.store === 'dotPos') {
      const configPath = files.getConfigPath(process.env.CONFIG_FILE_PATH);
      const config = files.getConfig() || {};
      const entry = config[source.environment];
      if (!entry) return;
      config[source.environment] = { ...entry, bound_tokens: { ...pruned(entry.bound_tokens), [host]: bound } };
      writeFileOwnerOnly(configPath, JSON.stringify(config, null, 2));
    } else {
      inMemory.set(`${source.root} ${host}`, bound);
    }
  } catch (error) {
    // Losing the cache costs one more bind next time, not the command.
    logger.Debug(`[globalBinding] Could not keep the bound token: ${error.message}`);
    inMemory.set(`${source.root} ${host}`, bound);
  }
};

// Expired bound tokens are dropped as new ones are kept.
const pruned = (boundTokens = {}) =>
  Object.fromEntries(Object.entries(boundTokens).filter(([, bound]) => live(bound)));

/**
 * A bind that failed, said in full: the command reports only the message (fetchSettings), so
 * it names the Portal, the instance and what to do. `reason` is for callers that act on it
 * (the MCP server): instance_not_covered, refused, portal_error or unreachable.
 */
class GlobalBindingError extends Error {
  constructor(message, reason, details = {}) {
    super(message);
    this.name = 'GlobalBindingError';
    this.reason = reason;
    Object.assign(this, details);
  }
}

// How a refused global token is replaced, which depends on where it is kept.
const renewal = (source, settings) => {
  if (source.store === 'portal') return `Renew it with: pos-cli portal add ${settings.portal} --force`;
  if (source.store === 'dotPos') {
    return `Create a new one on the Partner Portal Tokens page and add it with: pos-cli env add ${source.environment} --url ${settings.url} --token <token>`;
  }
  return 'Put a new one from the Partner Portal Tokens page in MPKIT_TOKEN.';
};

const bindingError = (error, host, source, settings) => {
  const { portalUrl } = source;
  const code = error?.response?.body?.error;
  if (code === 'instance_not_covered') {
    return new GlobalBindingError(`${host} is not an instance this global token reaches on ${portalUrl}. Use the instance's system URL, ` +
      'and check that a rule of the token covers it.', 'instance_not_covered');
  }
  // two_factor_not_enabled, insufficient_scope: explained as the same refusal from an instance is.
  if (isTokenRefusal(error)) {
    error.message = tokenRefusalMessage(error, { instance: settings.url });
    return error;
  }
  if (error?.statusCode === 401) {
    return new GlobalBindingError(`The global token was refused by ${portalUrl} -- it is expired or revoked. ${renewal(source, settings)}`,
      'refused', { portal: settings.portal });
  }
  if (error?.statusCode) {
    return new GlobalBindingError(`${portalUrl} answered ${error.statusCode}${code ? ` (${code})` : ''} when asked for a token for ${host}. ` +
      'Nothing is wrong with the token; try again shortly.', 'portal_error', { statusCode: error.statusCode });
  }
  const network = getNetworkErrorCode(error);
  if (network) {
    return new GlobalBindingError(`Could not reach ${portalUrl} (${network}) to get a token for ${host}.`, 'unreachable', { code: network });
  }
  return error;
};

// A bound token the Portal gave no lifetime is used for this command and not kept: a
// lifetime cannot be made up, and a token kept without one would never be renewed.
const expiryOf = (expiresIn) => (Number.isFinite(expiresIn) && expiresIn > 0
  ? new Date(Date.now() + expiresIn * 1000).toISOString()
  : null);

// A global token that needs a second factor is bound from a session, which the bound token
// then carries: the same prompt (--otp-code, POS_PORTAL_OTP_CODE) a deploy has always asked for.
const sessionFor = (source, settings, otpCode) =>
  ensureSession({ portalUrl: source.portalUrl, instanceUrl: settings.url, token: source.root, email: settings.email, otpCode });

// The Portal not answering -- a deploy of it, a restart, rate limiting, the network -- is a
// wait, not a failure: nothing was decided about the token. Said once, then retried after the
// Retry-After the Portal sent (clamped) or 10s, at most BIND_ATTEMPTS times.
const requestBinding = async (args, host) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await Portal.bindGlobalToken(args);
    } catch (error) {
      if (!(isPortalOutage(error) || getNetworkErrorCode(error)) || attempt >= BIND_ATTEMPTS) throw error;

      const seconds = retryAfterSeconds(error);
      if (attempt === 1) {
        const detail = error?.statusCode ? `HTTP ${error.statusCode}` : (getNetworkErrorCode(error) || error?.message);
        await logger.Warn(`${args.portalUrl} did not answer when asked for a token for ${host} (${detail}). Nothing is wrong with the token.`);
      }
      await logger.Info(`Waiting ${seconds}s for the Partner Portal, then retrying (${attempt}/${BIND_ATTEMPTS - 1}).`, { hideTimestamp: true });
      await sleep(seconds * 1000);
    }
  }
};

const bind = async (source, settings, host, session) => {
  let response;
  try {
    response = await requestBinding({ portalUrl: source.portalUrl, token: session?.token || source.root, instanceHost: host }, host);
  } catch (error) {
    // A token bound already (handed over in MPKIT_TOKEN, say) is used as it is.
    if (error?.statusCode === 422 && error?.response?.body?.error === 'not_bound') return null;
    throw bindingError(error, host, source, settings);
  }
  return {
    token: response.access_token,
    expires_at: expiryOf(Number(response.expires_in)),
    session: sessionMark(session)
  };
};

/**
 * The settings a command uses: the same, with the token of a global source replaced by one
 * bound to the instance at settings.url.
 */
const bindToInstance = async (settings, environment, { otpCode } = {}) => {
  if (!settings?.url || !settings.token) return settings;

  const source = globalSource(settings, environment);
  if (!source) return settings;

  const host = hostOf(settings.url);
  // A live bound token is used without asking the Portal anything: it cannot outlive the
  // session it was bound from, and one bound without a session -- the account needed none --
  // is refused by the instance (two_factor_required) once a session is needed, which drops it
  // (Gateway#boundTokenEnded). Asking for token info first cost every command a Portal round
  // trip, and a Portal outage failed commands that had all they needed.
  let bound = readBound(source, settings, host);
  if (!live(bound)) {
    const session = await sessionFor(source, settings, otpCode);
    bound = await bind(source, settings, host, session);
    if (!bound) return settings; // already a bound token
    rememberBoundThisRun(bound.token);
    if (bound.expires_at) keepBound(source, settings, host, bound);
  }

  return { ...settings, token: bound.token, partner_portal_url: source.portalUrl, bound: true };
};

/**
 * Forgets a bound token wherever it is kept, once an instance has refused it (it expired with
 * its session, or was revoked), so the next command binds a new one. Best effort.
 */
const dropBoundToken = (token) => {
  if (!isGlobalToken(token)) return;

  const without = (boundTokens = {}) => Object.fromEntries(Object.entries(boundTokens).filter(([, bound]) => bound?.token !== token));
  for (const [key, bound] of inMemory) if (bound?.token === token) inMemory.delete(key);
  try {
    for (const [name, portal] of Object.entries(readPortals())) {
      if (Object.values(portal?.bound_tokens || {}).some(bound => bound?.token === token)) {
        updatePortal(name, (entry) => ({ ...entry, bound_tokens: without(entry.bound_tokens) }));
      }
    }
    const config = files.getConfig() || {};
    const names = Object.keys(config).filter(name => Object.values(config[name]?.bound_tokens || {}).some(bound => bound?.token === token));
    if (names.length) {
      for (const name of names) config[name] = { ...config[name], bound_tokens: without(config[name].bound_tokens) };
      writeFileOwnerOnly(files.getConfigPath(process.env.CONFIG_FILE_PATH), JSON.stringify(config, null, 2));
    }
  } catch (error) {
    logger.Debug(`[globalBinding] Could not drop a refused bound token: ${error.message}`);
  }
};

export { GLOBAL_TOKEN_PREFIX, GlobalBindingError, bindToInstance, dropBoundToken, isBoundThisRun, isGlobalToken, rememberBoundThisRun };
