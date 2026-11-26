import os from 'os';
import open from 'open';
import Portal from '../portal.js';
import logger from '../logger.js';
import { normalizeBaseUrl } from '../utils/url.js';
import { DEFAULT_PORTAL_URL, getPortal, portalsPath, readPortals, removePortal, storePortal } from '../portals.js';

const NAME_FORMAT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// The device flow's poll (RFC 8628): authorization_pending until the user approves on the
// Portal, slow_down to back off, then the token or why there is none.
const waitForGlobalToken = async ({ portalUrl, deviceCode, interval, expiresIn }) => {
  let wait = interval;
  const deadline = Date.now() + expiresIn * 1000;

  while (Date.now() < deadline) {
    await sleep(wait);
    try {
      return await Portal.fetchGlobalToken({ portalUrl, deviceCode });
    } catch (error) {
      const code = error?.response?.body?.error;
      if (error?.statusCode !== 400 || !code) throw error;
      if (code === 'authorization_pending') continue;
      if (code === 'slow_down') { wait += 5000; continue; }
      if (code === 'access_denied') throw new Error('The request was denied on the Partner Portal. No token was made.');
      if (code === 'expired_token') break;
      throw new Error(`The Partner Portal refused the request (${code}). Run pos-cli portal add again.`);
    }
  }

  throw new Error('The code expired before it was approved. Run pos-cli portal add again.');
};

const describeExpiry = (expiresIn) => {
  if (!expiresIn) return 'never expires';
  return `expires ${new Date(Date.now() + expiresIn * 1000).toISOString().slice(0, 10)}`;
};

/**
 * pos-cli portal add <name> [--url <portal url>]
 *
 * Opens the Portal's token form in a browser (signing in there first, with a two-factor code
 * if the account has one), and stores the global token the user approves under <name>. The
 * token is never printed.
 */
const addPortal = async (name, { url = DEFAULT_PORTAL_URL, force = false } = {}) => {
  if (!NAME_FORMAT.test(name)) {
    throw new Error(`"${name}" is not a valid portal name: use letters, digits, dot, dash and underscore.`);
  }

  const portalUrl = normalizeBaseUrl(url);
  const existing = getPortal(name);
  if (existing && !force) {
    throw new Error(`A portal named "${name}" already exists (${existing.url}). ` +
      'Run pos-cli portal remove first, or pass --force to replace its token.');
  }

  // Becomes the token's default name on the Portal ("pos-cli: shared on mkk-laptop"), which
  // the user can change there before approving.
  const started = await Portal.requestGlobalTokenDevice({ portalUrl, clientName: `${name} on ${os.hostname()}` });
  const verificationUrl = started.verification_uri_complete;

  logger.Info(`Approve pos-cli on ${portalUrl}, and check that the page shows the code ${started.user_code}.`, { hideTimestamp: true });
  logger.Info(verificationUrl, { hideTimestamp: true });
  if (!process.env.CI) {
    try {
      await open(verificationUrl);
    } catch (error) {
      logger.Debug(`[portal add] Could not open a browser: ${error.message}`);
    }
  }

  const token = await waitForGlobalToken({
    portalUrl,
    deviceCode: started.device_code,
    interval: (started.interval ?? 5) * 1000,
    expiresIn: started.expires_in ?? 600
  });

  // --force replaces the token; the one replaced is revoked, not left live and forgotten.
  const replaced = existing?.token;

  // Only what pos-cli reads back: the credential, where it goes, and the email and scopes /
  // expiry `portal list` shows. Reach and the 2FA rule stay the Portal's -- a copy here would
  // only go stale -- and the token's id is never sent: the Portal takes it from the token.
  storePortal(name, {
    url: portalUrl,
    token: token.access_token,
    email: token.email,
    scopes: token.scopes,
    expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null
  });

  if (replaced && replaced !== token.access_token) {
    try {
      await Portal.revokeGlobalToken({ portalUrl: existing.url, token: replaced });
    } catch (error) {
      logger.Warn(`Could not revoke the token this replaced on ${existing.url} (${error.message}); revoke it on your Tokens page.`);
    }
  }

  logger.Success(`Portal ${name} (${portalUrl}) added for ${token.email}, ${describeExpiry(token.expires_in)}.`);
  for (const line of describeRules(token)) logger.Info(`  ${line}`, { hideTimestamp: true });
  logger.Info(`Use it with: pos-cli env add <environment> --url <instance url> --portal ${name}`, { hideTimestamp: true });
};

const chosenInstances = (count) => {
  if (!Number.isInteger(count)) return 'chosen instances';
  return `${count} chosen instance${count === 1 ? '' : 's'}`;
};

// One line per rule the token was approved with: where, which instances, what. A Portal too
// old to send rules gets one line from the token's own scopes.
const describeRules = (token) => {
  const rules = Array.isArray(token.rules) && token.rules.length
    ? token.rules
    : [{ endpoint: null, all_instances: token.all_instances, scopes: token.scopes || [] }];

  return rules.map((rule) => {
    const where = rule.endpoint || 'every endpoint';
    const which = rule.all_instances ? 'all instances' : chosenInstances(rule.instance_count);
    return `${where}, ${which}: ${(rule.scopes || []).join(' ')}`;
  });
};

const listPortals = () => {
  const portals = readPortals();
  const names = Object.keys(portals);
  if (!names.length) {
    logger.Info(`No portals yet (${portalsPath()}). Add one with: pos-cli portal add <name> --url <partner portal url>`, { hideTimestamp: true });
    return;
  }

  for (const name of names) {
    const portal = portals[name];
    const scopes = Array.isArray(portal.scopes) ? portal.scopes.join(' ') : '?';
    const expires = portal.expires_at ? `expires ${portal.expires_at.slice(0, 10)}` : 'no expiry';
    logger.Info(`${name}\t${portal.url}\t${portal.email || ''}\t${scopes}\t${expires}`, { hideTimestamp: true });
  }
};

// Revokes the token on the Portal first -- which also ends its two-factor sessions and has
// every stack forget it -- and forgets it here either way.
const removePortalCommand = async (name, { keepToken = false } = {}) => {
  const portal = getPortal(name);
  if (!portal) throw new Error(`There is no portal named "${name}".`);

  let revoked = false;
  if (!keepToken && portal.token) {
    try {
      await Portal.revokeGlobalToken({ portalUrl: portal.url, token: portal.token });
      revoked = true;
    } catch (error) {
      logger.Warn(`Could not revoke the token on ${portal.url} (${error.message}); revoke it on your Tokens page.`);
    }
  }

  removePortal(name);
  // Says what happened to the token: a removal that could not revoke it leaves it live on the
  // Portal, and a success line claiming otherwise is the one the operator would remember.
  if (revoked) logger.Success(`Portal ${name} removed and its token revoked.`);
  else if (keepToken) logger.Success(`Portal ${name} removed; its token was kept on the Partner Portal.`);
  else if (!portal.token) logger.Success(`Portal ${name} removed.`);
  else logger.Success(`Portal ${name} removed here; its token is still live on ${portal.url} until you revoke it.`);
};

export { addPortal, describeRules, listPortals, removePortalCommand, waitForGlobalToken };
