import logger from '../logger.js';
import * as validate from '../validators/index.js';
import { storeEnvironment, deviceAuthorizationFlow } from '../environments.js';
import { passwordLogin } from './passwordLogin.js';
import Portal from '../portal.js';
import { getPortal, missingPortalMessage } from '../portals.js';

const checkParams = (env, params) => {
  if (params.email) validate.email(params.email);

  if (params.url.slice(-1) != '/') {
    params.url = params.url + '/';
  }
  validate.url(params.url);
};

const saveToken = (settings, token) => {
  storeEnvironment(Object.assign(settings, { token: token }));
  logger.Success(`Environment ${settings.url} as ${settings.environment} has been added successfully.`);
};

/**
 * `env add <env> --url <site> --portal <name>`: an environment that uses the portal's
 * global token instead of a token for this instance alone.
 *
 * A global token reaches many instances, so it is not sent to the URL before the Portal
 * confirms that the URL's host belongs to one of them: a mistyped or hostile URL would
 * otherwise receive a credential for all the rest. The Portal answers for instances the
 * token covers only, by host. Only the URL and the portal's name are stored: the URL picks
 * the instance on every request, and the instance checks the token against its own uuid.
 */
const addPortalEnv = async (environment, params) => {
  if (params.token || params.email) {
    throw new Error('--portal uses the portal\'s global token, so it cannot be combined with --token or --email.');
  }

  const portal = getPortal(params.portal);
  if (!portal) throw new Error(missingPortalMessage(params.portal));

  const host = new URL(params.url).hostname;
  let info;
  try {
    info = await Portal.tokenInfo({ portalUrl: portal.url, token: portal.token, instanceHost: host });
  } catch (error) {
    if (error?.statusCode === 401) {
      throw new Error(`The token of portal ${params.portal} is no longer valid (expired or revoked). ` +
        `Run pos-cli portal add ${params.portal} --force.`);
    }
    throw error;
  }

  if (!info?.global) {
    throw new Error(`The Partner Portal at ${portal.url} did not recognise portal ${params.portal}'s token as a global token.`);
  }
  if (!info.resource_uuid) {
    throw new Error(`${host} is not an instance that portal ${params.portal}'s token reaches on ${portal.url}. ` +
      'Use the instance\'s system URL -- the one under its stack\'s own domain, never a custom domain -- and check that ' +
      'a rule of the token covers the instance (on your Tokens page).');
  }

  storeEnvironment({ environment, url: params.url, portal: params.portal });
  const scopes = Array.isArray(info.scopes_granted) ? info.scopes_granted.join(' ') : 'full access';
  logger.Success(`Environment ${params.url} as ${environment} has been added, using portal ${params.portal} (${scopes}).`);
};

const addEnv = async (environment, params) => {
  logger.Debug(`[addEnv] Adding environment: ${environment}`);
  logger.Debug(`[addEnv] URL: ${params.url}`);
  logger.Debug(`[addEnv] Partner Portal URL: ${params.partnerPortalUrl || 'default'}`);

  checkParams(environment, params);
  if (params.portal) return addPortalEnv(environment, params);

  if (params.partnerPortalUrl) {
    process.env['PARTNER_PORTAL_HOST'] ||= params.partnerPortalUrl;
  }

  const settings = {
    url: params.url,
    environment: environment,
    email: params.email,
    partner_portal_url: process.env['PARTNER_PORTAL_HOST']
  };

  let token;
  if (params.token) {
    token = params.token;
  } else if (!params.email){
    token = await deviceAuthorizationFlow(params.url);
  } else {
    token = await passwordLogin({ email: params.email, url: params.url, otpCode: params.otpCode });
  }

  if (token) {
    logger.Debug('[addEnv] Token obtained, length: ' + (token?.length || 0));
    saveToken(settings, token);
  } else {
    logger.Debug('[addEnv] ERROR: Token is falsy, cannot save environment');
  }
};

export default addEnv;
