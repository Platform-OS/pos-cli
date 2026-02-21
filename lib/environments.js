import fs from 'fs';
import open from 'open';
import files from '../lib/files.js';
import Portal from '../lib/portal.js';
import logger from '../lib/logger.js';
import waitForStatus from '../lib/data/waitForStatus.js';

const storeEnvironment = settings => {
  logger.Debug(`[storeEnvironment] Input settings: ${JSON.stringify(settings, null, 2)}`);

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

  const existingConfig = files.getConfig();
  logger.Debug(`[storeEnvironment] Existing config: ${JSON.stringify(existingConfig)}`);

  const newSettings = Object.assign({}, existingConfig, environmentSettings);
  logger.Debug(`[storeEnvironment] New config to write: ${JSON.stringify(newSettings)}`);

  fs.writeFileSync(configPath, JSON.stringify(newSettings, null, 2));
  logger.Debug(`[storeEnvironment] Successfully wrote config to ${configPath}`);
};

const waitForAccessToken = async (deviceCode, interval) => {
  logger.Debug('[waitForAccessToken] Starting token polling');
  logger.Debug('[waitForAccessToken] deviceCode: ' + deviceCode);
  logger.Debug('[waitForAccessToken] interval: ' + interval + 'ms');

  const tokenResponse = await waitForStatus(
    () => {
      logger.Debug('[waitForAccessToken] Fetching device token');
      return Portal.fetchDeviceAccessToken(deviceCode).then(response => {
        logger.Debug('[waitForAccessToken] Token response status: ' + (response.status || response.statusCode));
        logger.Debug('[waitForAccessToken] Token response keys: ' + Object.keys(response).join(', '));
        let token;
        if (response['access_token']) {
          token = { ...response, status: 'success' };
          logger.Debug('[waitForAccessToken] access_token found in response');
        } else {
          logger.Debug('[waitForAccessToken] No access_token in response');
          throw `Unhandled response: ${response.statusCode}`;
        }

        return Promise.resolve(token);
      })
        .catch(request => {
          logger.Debug('[waitForAccessToken] Token fetch error, statusCode: ' + request.statusCode);
          switch (request.statusCode) {
            case 400: {
              const token = { status: request.response.body.error };
              logger.Debug('[waitForAccessToken] 400 error, error: ' + request.response.body.error);
              return Promise.resolve(token);
            }
            default:
              logger.Debug('[waitForAccessToken] Unexpected error, throwing');
              throw request;
          }
        });
    }, 'authorization_pending', 'success', interval
  );

  logger.Debug('[waitForAccessToken] Completed, tokenResponse: ' + JSON.stringify(tokenResponse));
  return tokenResponse['access_token'];
};

const deviceAuthorizationFlow = async (instanceUrl) => {
  const instanceDomain = (new URL(instanceUrl)).hostname;

  logger.Debug('[deviceAuthorizationFlow] Instance URL: ' + instanceUrl);
  logger.Debug('[deviceAuthorizationFlow] Instance domain: ' + instanceDomain);
  logger.Debug('[deviceAuthorizationFlow] Partner Portal URL: ' + Portal.url());

  let deviceAuthorizationResponse;
  try {
    logger.Debug('[deviceAuthorizationFlow] Requesting device authorization...');
    deviceAuthorizationResponse = await Portal.requestDeviceAuthorization(instanceDomain);
    logger.Debug('[deviceAuthorizationFlow] Device authorization response:', deviceAuthorizationResponse);
  } catch (error) {
    // Handle the case where instance is not registered in partner portal
    if (error.statusCode === 404 && error.options?.uri?.includes('/oauth/authorize_device')) {
      await logger.Error(
        `Instance ${instanceUrl} is not registered in the Partner Portal.\n` +
        'Please double-check if the instance URL is correct.',
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

  logger.Debug('[deviceAuthorizationFlow] Verification URL: ' + verificationUrl);
  logger.Debug('[deviceAuthorizationFlow] Device code: ' + deviceCode);
  logger.Debug('[deviceAuthorizationFlow] Poll interval: ' + interval + 'ms');
  logger.Debug('[deviceAuthorizationFlow] Waiting for user to authorize at ' + verificationUrl);
  const openFn = process.env['CI'] ? console.log : open;
  try {
    await openFn(verificationUrl);
  } catch (error) {
    if (error instanceof AggregateError) {
      await logger.Error(`Failed to open browser (${error.errors.length} attempts): ${error.message}`);
    } else {
      await logger.Error(`Failed to open browser: ${error.message}`);
    }
  }

  const accessToken = await waitForAccessToken(deviceCode, interval);
  logger.Debug('[deviceAuthorizationFlow] Received access token, length: ' + (accessToken?.length || 0));
  return accessToken;
};

export {
  deviceAuthorizationFlow,
  storeEnvironment
};
