import logger from '../logger.js';
import * as validate from '../validators/index.js';
import { storeEnvironment, deviceAuthorizationFlow } from '../environments.js';
import { passwordLogin } from './passwordLogin.js';

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

const addEnv = async (environment, params) => {
  logger.Debug(`[addEnv] Adding environment: ${environment}`);
  logger.Debug(`[addEnv] URL: ${params.url}`);
  logger.Debug(`[addEnv] Partner Portal URL: ${params.partnerPortalUrl || 'default'}`);

  checkParams(environment, params);
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
