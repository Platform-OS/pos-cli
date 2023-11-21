const fs = require('fs');
const open = require('open');
const files = require('../lib/files');
const Portal = require('../lib/portal');
const logger = require('../lib/logger');
const waitForStatus = require('../lib/data/waitForStatus');

const storeEnvironment = settings => {
  logger.Debug(`[storeEnvironment] ${JSON.stringify(settings, null, 2)}`);

  const environmentSettings = {
    [settings.environment]: {
      url: settings.url,
      token: settings.token,
      email: settings.email
    }
  };

  const configPath = files.getConfigPath();
  logger.Debug(`[storeEnvironment] Current config path: ${configPath}`);

  const newSettings = Object.assign({}, files.getConfig(), environmentSettings);
  fs.writeFileSync(configPath, JSON.stringify(newSettings, null, 2));
};

const waitForAccessToken = async (deviceCode, interval) => {
  const tokenResponse = await waitForStatus(
    () => {
      return Portal.fetchDeviceAccessToken(deviceCode).then(response => {
        let token;
        if (response['access_token']) {
          token = { ...response, status: 'success' };
        } else {
          // TODO: use node-fetch instead of request-promise
          const responseBody = response.response.body;
          switch(response.response.statusCode){
            case 400:
              token = { status: responseBody.error };
              break;
            case 200:
              token = { ...responseBody, status: 'success' };
              break;
            default:
              throw `Unhandled response: ${response.statusCode}`
          }
        }

        return Promise.resolve(token);
      })
    }, 'authorization_pending', 'success', interval
  );

  return tokenResponse['access_token'];
};

const deviceAuthorizationFlow = async (instanceUrl) => {
  const instanceDomain = (new URL(instanceUrl)).hostname;
  const deviceAuthorizationResponse = await Portal.requestDeviceAuthorization(instanceDomain);
  logger.Debug('deviceAuthorizationResponse', deviceAuthorizationResponse);

  const deviceAuthorization = JSON.parse(deviceAuthorizationResponse);
  const verificationUrl = deviceAuthorization['verification_uri_complete'];
  const deviceCode = deviceAuthorization['device_code']
  const interval = (deviceAuthorization['interval'] || 5) * 1000;

  await open(verificationUrl);

  const accessToken = await waitForAccessToken(deviceCode, interval);
  return accessToken;
};

module.exports = {
  deviceAuthorizationFlow: deviceAuthorizationFlow,
  storeEnvironment: storeEnvironment
}
