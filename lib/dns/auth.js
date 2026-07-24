import logger from '../logger.js';
import { settingsFromDotPos } from '../settings.js';
import { readPassword } from '../utils/password.js';
import { DnsPortalClient, PortalAuthError, normalizeBaseUrl } from './portalClient.js';
import { assertWritablePortal } from './guard.js';
import { hostnameOf } from './cliHelpers.js';

const DEFAULT_PORTAL_URL = 'https://partners.platformos.com';

// dns commands deliberately read .pos entries and flags only (not MPKIT_* env vars):
// a two-portal tool must never resolve source and target to the same ambient credentials.
const resolveSettings = (envName, label) => {
  if (!envName) return {};
  const settings = settingsFromDotPos(envName);
  if (!settings) {
    throw new Error(
      `No settings for ${label} environment "${envName}" — add it with \`pos-cli env add ${envName}\` ` +
      'or pass --portal-url/--token flags instead of an environment name.'
    );
  }
  return settings;
};

const authenticateInteractively = async (baseUrl, email) => {
  await logger.Info(`Authenticating ${email} on ${baseUrl}`);
  const password = await readPassword();
  return DnsPortalClient.authenticate(baseUrl, email, password);
};

// Resolves everything a dns command needs to talk to one portal ("source" or "target"):
// an authenticated client and the instance uuid. Order: .pos env entry -> flag overrides
// -> interactive email/password fallback (session-only JWT, never persisted).
const resolvePortalContext = async (envName, {
  portalUrl,
  token,
  email,
  instanceUuid,
  label = 'portal',
  readOnly = false,
  skipInstanceLookup = false,
  allowProtectedTarget = false,
  // Bins pass interactive: !params.json — a password prompt writes to stdout, which
  // would corrupt machine-readable output (the same reasoning as guard.js's confirmApply).
  interactive = true
} = {}) => {
  const settings = resolveSettings(envName, label);
  // Deliberately NO ambient PARTNER_PORTAL_HOST fallback (unlike lib/portal.js): a
  // process-global env var could silently point BOTH sides of a two-portal command
  // at the same place. Only per-env settings, explicit flags, or the public default.
  const baseUrl = normalizeBaseUrl(portalUrl || settings.partner_portal_url || DEFAULT_PORTAL_URL);
  hostnameOf(baseUrl, `${label} portal url`);

  // A write context to a protected portal (the legacy production portal) is refused
  // here, centrally — every dns command resolves through this path.
  if (!readOnly) assertWritablePortal(baseUrl, { allowProtectedTarget });

  let authToken = token || settings.token;
  if (email) {
    if (!interactive) {
      throw new Error(
        `Authenticating the ${label} portal as ${email} needs an interactive password prompt, ` +
        'which would corrupt --json output — pass --token or use a stored environment token instead.'
      );
    }
    authToken = await authenticateInteractively(baseUrl, email);
  }
  if (!authToken) {
    throw new Error(
      `No credentials for ${label} portal ${baseUrl} — pass an environment name, --token, or --email.`
    );
  }

  let client = new DnsPortalClient({ baseUrl, token: authToken, readOnly });

  try {
    await client.listInstances();
  } catch (error) {
    const fallbackEmail = settings.email;
    const tty = process.stdin.isTTY;
    if (!(error instanceof PortalAuthError) || email || !fallbackEmail || !tty || !interactive) throw error;

    await logger.Warn(error.message);
    authToken = await authenticateInteractively(baseUrl, fallbackEmail);
    client = new DnsPortalClient({ baseUrl, token: authToken, readOnly });
    await client.listInstances();
  }

  const uuid = skipInstanceLookup
    ? instanceUuid
    : await resolveInstanceUuid(client, { instanceUuid, instanceUrl: settings.url, label });

  return {
    client,
    instanceUuid: uuid,
    instanceUrl: settings.url,
    portalUrl: baseUrl,
    envName
  };
};

const resolveInstanceUuid = async (client, { instanceUuid, instanceUrl, label }) => {
  if (instanceUuid) return instanceUuid;
  if (!instanceUrl) {
    throw new Error(`Cannot determine the ${label} instance — pass --${label}-instance-uuid.`);
  }

  const hostname = hostnameOf(instanceUrl, `${label} environment instance url`);
  const response = await client.searchInstances({ domain: hostname });
  const matches = (response && response.data) || [];
  if (matches.length === 1) return matches[0].uuid;

  const all = await client.listInstances().catch(() => null);
  const candidates = ((all && all.data) || [])
    .map(instance => `  ${instance.uuid}  ${instance.name}`)
    .join('\n');
  const problem = matches.length === 0
    ? `No instance on ${client.baseUrl} has the domain ${hostname}`
    : `${matches.length} instances on ${client.baseUrl} match the domain ${hostname}`;
  throw new Error(
    `${problem} — pass --${label}-instance-uuid explicitly.` +
    (candidates ? `\nInstances your token can access:\n${candidates}` : '')
  );
};

export { resolvePortalContext };
