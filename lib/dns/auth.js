import logger from '../logger.js';
import { settingsFromDotPos } from '../settings.js';
import { readPassword } from '../utils/password.js';
import { DnsPortalClient, PortalAuthError } from './portalClient.js';

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
  logger.Info(`Authenticating ${email} on ${baseUrl}`);
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
  skipInstanceLookup = false
} = {}) => {
  const settings = resolveSettings(envName, label);
  const baseUrl = (portalUrl || settings.partner_portal_url || process.env.PARTNER_PORTAL_HOST || DEFAULT_PORTAL_URL)
    .replace(/\/+$/, '');

  let authToken = token || settings.token;
  if (email) {
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
    const interactive = process.stdin.isTTY;
    if (!(error instanceof PortalAuthError) || email || !fallbackEmail || !interactive) throw error;

    logger.Warn(`${error.message}`);
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

  const hostname = new URL(instanceUrl).hostname;
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

export { resolvePortalContext, resolveInstanceUuid, DEFAULT_PORTAL_URL };
