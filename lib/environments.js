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
          throw `Unhandled response: ${response.statusCode}`;
        }

        return Promise.resolve(token);
      })
      .catch(request => {
        switch (request.statusCode) {
          case 400:
            token = { status: request.response.body.error }
            return Promise.resolve(token);
            break;
          default:
            throw errors
        }
      });
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
