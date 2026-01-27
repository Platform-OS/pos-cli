import fs from 'fs';
import open from 'open';
import files from '../lib/files.js';
import Portal from '../lib/portal.js';
import logger from '../lib/logger.js';
import waitForStatus from '../lib/data/waitForStatus.js';

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

  let deviceAuthorizationResponse;
  try {
    deviceAuthorizationResponse = await Portal.requestDeviceAuthorization(instanceDomain);
  } catch (error) {
    // Handle the case where instance is not registered in partner portal
    if (error.statusCode === 404 && error.options?.uri?.includes('/oauth/authorize_device')) {
      logger.Error(
        `Instance ${instanceUrl} is not registered in the Partner Portal.\n` +
        `Please double-check if the instance URL is correct.`,
        { hideTimestamp: true, exit: false }
      );
      throw error;
    }
    throw error;
  }

  logger.Debug('deviceAuthorizationResponse', deviceAuthorizationResponse);

  const deviceAuthorization = deviceAuthorizationResponse;
  const verificationUrl = deviceAuthorization['verification_uri_complete'];
  const deviceCode = deviceAuthorization['device_code'];
  const interval = (deviceAuthorization['interval'] || 5) * 1000;

  logger.Debug('verificationUrl', verificationUrl);
  const openFn = process.env['CI'] ? console.log : open;
  try {
    await openFn(verificationUrl);
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
