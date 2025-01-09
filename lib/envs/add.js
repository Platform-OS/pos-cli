const Portal = require('../portal');
const logger = require('../logger');
const validate = require('../validators');
const { storeEnvironment, deviceAuthorizationFlow } = require('../environments');
const waitForStatus = require('../data/waitForStatus');
const { readPassword } = require('../utils/password');

const checkParams = (env, params) => {
  if (params.email) validate.email(params.email);

  if (params.url.slice(-1) != '/') {
    params.url = params.url + '/';
  }
  validate.url(params.url);
};

const saveToken = (settings, token) => {
  storeEnvironment(Object.assign(settings, { token: token }));
  logger.Success(`Environment ${settings.url} as ${settings.environment} has been added successfuly.`);
};

const login = async (email, password, url) => {
  return Portal.login(email, password, url)
    .then(response => {
      if (response) return Promise.resolve(response[0].token);
    })
}

const addEnv = async (environment, params) => {
  checkParams(environment, params);
  if (params.partnerPortalUrl) {
    process.env['PARTNER_PORTAL_HOST'] ||= params.partnerPortalUrl
  }

  const settings = {
    url: params.url,
    environment: environment,
    email: params.email,
    partner_portal_url: process.env['PARTNER_PORTAL_HOST']
  };

  if (params.token) {
    token = params.token;
  } else if (!params.email){
    token = await deviceAuthorizationFlow(params.url);
  } else {
    logger.Info(
      `Please make sure that you have a permission to deploy. \n You can verify it here: ${Portal.url()}/me/permissions`,
      { hideTimestamp: true }
    );

    const password = await readPassword();
    logger.Info(`Asking ${Portal.url()} for access token...`);

    token = await login(params.email, password, params.url);
  }

  if (token) saveToken(settings, token);
}

module.exports = addEnv;
