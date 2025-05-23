const fs = require('fs');
const files = require('../lib/files');
const Portal = require('../lib/portal');
const logger = require('../lib/logger');
const waitForStatus = require('../lib/data/waitForStatus');

// importing ESM modules in CommonJS project
let open;
const initializeEsmModules = async () => {
  if (process.env['CI']) open = console.log

  if(!open) {
    await import('open').then(imported => open = imported.default);
  }
  return true;
}

const storeEnvironment = settings => {
  logger.Debug(`[storeEnvironment] ${JSON.stringify(settings, null, 2)}`);

  const environmentSettings = {
    [settings.environment]: {
      url: settings.url,
      token: settings.token,
      email: settings.email,
      partner_portal_url: settings.partner_portal_url
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
            throw request
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

  const deviceAuthorization = deviceAuthorizationResponse;
  const verificationUrl = deviceAuthorization['verification_uri_complete'];
  const deviceCode = deviceAuthorization['device_code']
  const interval = (deviceAuthorization['interval'] || 5) * 1000;

  await initializeEsmModules();
  logger.Debug('verificationUrl', verificationUrl);
  await open(verificationUrl);

  const accessToken = await waitForAccessToken(deviceCode, interval);
  return accessToken;
};

module.exports = {
  deviceAuthorizationFlow: deviceAuthorizationFlow,
  storeEnvironment: storeEnvironment
}
