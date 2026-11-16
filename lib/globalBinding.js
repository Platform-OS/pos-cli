import Portal from './portal.js';
import logger from './logger.js';
import files from './files.js';
import { writeFileOwnerOnly } from './filePermissions.js';
import { getPortal, updatePortal } from './portals.js';
import { ensureSession } from './twoFactorSession.js';

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
 * GLOBAL_TOKEN_PREFIX (AccessTokens::TokenGenerator), so no request is needed to tell. A
 * per-instance token from `env add` is used as it is.
 *
 * A bound token is kept until shortly before it expires: on the portal for a portal
 * environment, on the .pos entry otherwise, in memory for MPKIT_*.
 */

const EXPIRY_MARGIN_MS = 5 * 60 * 1000;
const GLOBAL_TOKEN_PREFIX = 'posg_';
const inMemory = new Map();

const live = (bound) => bound?.token && bound.expires_at && Date.parse(bound.expires_at) - EXPIRY_MARGIN_MS > Date.now();

const hostOf = (url) => new URL(url).hostname.toLowerCase();

// The global token behind a set of settings, and where its bound tokens are kept -- or null
// when the settings carry no global token.
const globalSource = (settings, environment) => {
  if (settings.portal) {
    const portal = getPortal(settings.portal);
    return portal && { root: portal.token, portalUrl: portal.url, store: 'portal' };
  }
  if (!String(settings.token).startsWith(GLOBAL_TOKEN_PREFIX)) return null;

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

const bindingError = (error, host, portalUrl) => {
  const code = error?.response?.body?.error;
  if (code === 'instance_not_covered') {
    return new Error(`${host} is not an instance this global token reaches on ${portalUrl}. Use the instance's system URL, ` +
      'and check that a rule of the token covers it.');
  }
  if (error?.statusCode === 401 && !code) {
    return new Error(`The global token was refused by ${portalUrl} -- it is expired or revoked.`);
  }
  return error;
};

const bind = async (source, settings, host) => {
  // A global token that needs a second factor is bound from a session, which the bound token
  // then carries: the same prompt (or POS_PORTAL_OTP_CODE) a deploy has always asked for.
  const session = await ensureSession({
    portalUrl: source.portalUrl, instanceUrl: settings.url, token: source.root, email: settings.email
  });
  try {
    const response = await Portal.bindGlobalToken({ portalUrl: source.portalUrl, token: session?.token || source.root, instanceHost: host });
    return { token: response.access_token, expires_at: new Date(Date.now() + response.expires_in * 1000).toISOString() };
  } catch (error) {
    // A token bound already (handed over in MPKIT_TOKEN, say) is used as it is.
    if (error?.statusCode === 422 && error?.response?.body?.error === 'not_bound') return null;
    throw bindingError(error, host, source.portalUrl);
  }
};

/**
 * The settings a command uses: the same, with the token of a global source replaced by one
 * bound to the instance at settings.url.
 */
const bindToInstance = async (settings, environment) => {
  if (!settings?.url || !settings.token) return settings;

  const source = globalSource(settings, environment);
  if (!source) return settings;

  const host = hostOf(settings.url);
  let bound = readBound(source, settings, host);
  if (!live(bound)) {
    bound = await bind(source, settings, host);
    if (!bound) return settings; // already a bound token
    keepBound(source, settings, host, bound);
  }

  return { ...settings, token: bound.token, partner_portal_url: source.portalUrl, bound: true };
};

export { GLOBAL_TOKEN_PREFIX, bindToInstance };
