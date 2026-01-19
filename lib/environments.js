import fs from 'fs';
import files from '../lib/files.js';
import Portal from '../lib/portal.js';
import logger from '../lib/logger.js';
import waitForStatus from '../lib/data/waitForStatus.js';

let open;
const initializeEsmModules = async () => {
  if (process.env['CI']) open = console.log;

  if(!open) {
    await import('open').then(imported => open = imported.default);
  }
  return true;
};

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
            case 400: {
              const token = { status: request.response.body.error };
              return Promise.resolve(token);
            }
            default:
              throw request;
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
  const deviceCode = deviceAuthorization['device_code'];
  const interval = (deviceAuthorization['interval'] || 5) * 1000;

  await initializeEsmModules();
  logger.Debug('verificationUrl', verificationUrl);
  try {
    await open(verificationUrl);
  } catch (error) {
    if (error instanceof AggregateError) {
      logger.Error(`Failed to open browser (${error.errors.length} attempts): ${error.message}`);
    } else {
      logger.Error(`Failed to open browser: ${error.message}`);
    }
  }

  const accessToken = await waitForAccessToken(deviceCode, interval);
  return accessToken;
};

export {
  deviceAuthorizationFlow,
  storeEnvironment
};
