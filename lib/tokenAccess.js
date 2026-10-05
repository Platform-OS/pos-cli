import Portal from './portal.js';
import logger from './logger.js';
import { permits } from './utils/tokenScopes.js';

/**
 * What the Partner Portal says a token may do: its scopes, and whether it is a global
 * token (one credential for the instances its owner chose) rather than one issued for a
 * single instance.
 *
 * `scopes` is the list of scope patterns the Portal reports as `scopes_granted` -- for the
 * instance named by `instanceUuid` when one is given, narrowed to what the owner may do
 * there -- or null for a token that carries no scopes, which has full access. Match it with
 * `permits` from ./utils/tokenScopes.js.
 *
 * Only ever used to shape what pos-cli offers -- the GUI hides what it cannot do, and a
 * command that could only fail says so before it starts. It enforces nothing: the Instance
 * asks the Portal the same question and refuses what the token may not do whatever this
 * says. So a Portal that cannot answer, or one too old to report scopes, reads as full
 * access, and the operator meets the Instance's own refusal if there is one.
 */
const tokenAccess = async ({ portalUrl, token, instanceUuid }) => {
  try {
    const info = await Portal.tokenInfo({ portalUrl, token, instanceUuid });
    const scopes = Array.isArray(info?.scopes_granted) ? info.scopes_granted : null;
    return { scopes, global: !!info?.global };
  } catch (error) {
    logger.Debug(`[tokenAccess] Could not read token info: ${error.message}`);
    return { scopes: null, global: false };
  }
};

// What `pos-cli gui serve --sync` has to refuse up front, or null when it may start: the
// watcher ends the process on the first refusal, and the web server would come down with it.
const guiSyncRefusal = (scopes) => {
  if (permits(scopes, 'code:write')) return null;

  return 'This token does not have the code:write scope, so it cannot sync files. Run `pos-cli gui serve` without --sync, ' +
    'or use a token that has it.';
};

export { guiSyncRefusal, tokenAccess };
