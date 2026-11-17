/**
 * A Partner Portal global token carries scopes -- `records:read`, `code:write`, ... -- and
 * an Instance refuses whatever a token's scopes do not cover as
 * `403 {"error":"insufficient_scope","required_scopes":[...]}`.
 *
 * Told apart from every other refusal on purpose. It is not a 401: the token is valid and
 * `pos-cli env refresh-token` would only mint another one with the same scopes, so the
 * advice a 401 carries is exactly wrong here. This module is the one place that knows the
 * scope rules, so the CLI, the GUI server, the GUI and watch mode all read them the same way.
 */
const INSUFFICIENT_SCOPE = 'insufficient_scope';

// The Partner Portal refuses a global token with two more 403s, each needing its own fix and
// neither fixable by `refresh-token`:
// - two_factor_not_enabled: the token needs a two-factor session, but its account has no
//   second factor (turned off since, or never set up while its Partner requires one), so no
//   session can ever be had. Asking for a code would loop forever.
// - instance_not_covered: the token has the scope, but does not reach that instance, or its
//   owner cannot change it.
const TWO_FACTOR_NOT_ENABLED = 'two_factor_not_enabled';
const INSTANCE_NOT_COVERED = 'instance_not_covered';

const ALL = '*';
const ALL_READS = '*:read';
const READ_SUFFIX = ':read';

// Reads that hand over a secret -- constant values (one signs every user's JWT) and the data
// export (a copy of the whole database) -- so `*:read` does not cover them. Keep in step with
// the list the Instance and the Partner Portal apply.
const SECRET_READS = ['constants:read', 'data_import:read'];

const isRead = scope => scope.endsWith(READ_SUFFIX);

// What a scope is about: 'users' for users:read and users:write.
const subjectOf = scope => scope.slice(0, scope.lastIndexOf(':'));

/**
 * Whether granted scope patterns cover a required scope. The same rule the Instance
 * and the Partner Portal apply:
 *
 * - `*` is every scope, and a scope covers itself;
 * - `*:read` is every read except SECRET_READS;
 * - a write means read + write: any scope that is not a read covers the read of the same
 *   subject (users:write reads users, instance:manage reads the instance, constants:write
 *   reads constants), secret reads included.
 *
 * `null` granted means the token carries no scopes -- a per-instance token -- which has
 * always had full access.
 */
const permits = (granted, required) => {
  if (granted === null || granted === undefined) return true;
  if (!Array.isArray(granted)) return false;

  if (granted.includes(ALL) || granted.includes(required)) return true;
  if (!isRead(required)) return false;
  if (granted.includes(ALL_READS) && !SECRET_READS.includes(required)) return true;

  return granted.some(scope => typeof scope === 'string' && !isRead(scope) && subjectOf(scope) === subjectOf(required));
};

const bodyOf = (error) => {
  const body = error?.response?.body;
  return body && typeof body === 'object' ? body : null;
};

const isInsufficientScopeRefusal = (error) =>
  error?.statusCode === 403 && bodyOf(error)?.error === INSUFFICIENT_SCOPE;

// A two-factor refusal, so the Portal answers it 401 like the others and only the body
// tells it apart. 403 is still read, as the Portal answered it briefly during development.
const isTwoFactorNotEnabled = (error) =>
  [401, 403].includes(error?.statusCode) && bodyOf(error)?.error === TWO_FACTOR_NOT_ENABLED;

const isInstanceNotCovered = (error) =>
  error?.statusCode === 403 && bodyOf(error)?.error === INSTANCE_NOT_COVERED;

const requiredScopesOf = (error) => {
  const scopes = bodyOf(error)?.required_scopes;
  return Array.isArray(scopes) ? scopes.filter(scope => typeof scope === 'string' && scope) : [];
};

const hostOf = (error) => {
  try {
    return new URL(error?.options?.uri).host;
  } catch {
    return null;
  }
};

// What the Instance said, when it said anything. It answers in GraphQL's shape --
// `errors: [{ message }]` -- but plain strings are read too.
const instanceReason = (error) => {
  const errors = bodyOf(error)?.errors;
  if (!Array.isArray(errors)) return null;

  const messages = errors
    .map(entry => (typeof entry === 'string' ? entry : entry?.message))
    .filter(Boolean);

  return messages.length ? messages.join('\n') : null;
};

const scopeList = (scopes) => {
  if (scopes.length === 1) return `the ${scopes[0]} scope`;

  return `the ${scopes.slice(0, -1).join(', ')} and ${scopes[scopes.length - 1]} scopes`;
};

const hostOfUrl = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

// `instance` is the instance URL when the caller knows it. Preferred over the request's own
// host, which is not the instance's when the request went elsewhere -- a presign sent to
// DEPLOY_SERVICE_URL.
const insufficientScopeMessage = (error, { instance } = {}) => {
  const scopes = requiredScopesOf(error);
  const host = hostOfUrl(instance) || hostOf(error) || 'this instance';

  // An empty required_scopes means no scope would help: the request is closed to every
  // token limited to scopes, or the instance could not tell what it needs (a GraphQL
  // document it could not read). Telling the operator to add a scope would send them after
  // one that does not exist.
  if (!scopes.length) {
    const reason = instanceReason(error);
    return `This token's scopes do not allow this on ${host}.` +
      (reason ? `\n${reason}` : '') +
      '\nNo scope covers it: use a token that is not limited to scopes (an Administrator token, or one from `pos-cli env add`).' +
      '\nThis is not something `pos-cli env refresh-token` can fix — the token is valid, it is just limited.';
  }

  return `This token does not have ${scopeList(scopes)} needed for this on ${host}.` +
    '\nCreate a token with it on the Partner Portal Tokens page.' +
    '\nThis is not something `pos-cli env refresh-token` can fix — the token is valid, it just does not have that scope.';
};

const twoFactorNotEnabledMessage = () =>
  'This token needs a two-factor session, but two-factor authentication is not enabled on its account. ' +
  'Enable it again on the Partner Portal (Your account → Two-factor authentication), or create a new token.';

// `instance` names the instance when the caller knows it. A refusal from the Portal's own
// API carries the Portal's URL, not the instance's, so the host is never guessed from it.
const instanceNotCoveredMessage = (instance) =>
  `This token does not reach ${instance || 'this instance'}, or its owner cannot change it. ` +
  'Use a token created for this instance (or for all instances) on the Partner Portal Tokens page.';

// Every refusal of a valid token for what it is not allowed to do, whichever side sent it.
// Callers that only need "is this one of those, and what do we say" ask these two.
const isTokenRefusal = (error) =>
  isInsufficientScopeRefusal(error) || isTwoFactorNotEnabled(error) || isInstanceNotCovered(error);

// `instance` defaults to the one the Gateway recorded on the error (explainTokenRefusal), so
// a caller reporting the refusal later -- reportCommandError, ServerError -- names the same
// instance the Gateway did rather than the host the request went to.
const tokenRefusalMessage = (error, { instance = error?.instance } = {}) => {
  if (isInsufficientScopeRefusal(error)) return insufficientScopeMessage(error, { instance });
  if (isTwoFactorNotEnabled(error)) return twoFactorNotEnabledMessage();
  if (isInstanceNotCovered(error)) return instanceNotCoveredMessage(instance);
  return null;
};

export {
  ALL,
  ALL_READS,
  INSTANCE_NOT_COVERED,
  INSUFFICIENT_SCOPE,
  SECRET_READS,
  TWO_FACTOR_NOT_ENABLED,
  instanceNotCoveredMessage,
  instanceReason,
  insufficientScopeMessage,
  isInstanceNotCovered,
  isInsufficientScopeRefusal,
  isTokenRefusal,
  isTwoFactorNotEnabled,
  tokenRefusalMessage,
  twoFactorNotEnabledMessage,
  permits,
  requiredScopesOf
};
