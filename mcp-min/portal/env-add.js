// env-add tool - Add environment using device authorization flow
import log from '../log.js';
import { getPortalConfig, portalRequest } from './portal-client.js';
import fs from 'fs';
import path from 'path';

// Default Partner Portal URL
const DEFAULT_PORTAL_URL = 'https://partners.platformos.com';

// Track active background waiters
const activeWaiters = new Map();

// Cleanup on process exit
process.on('exit', () => {
  log.debug('Process exit, clearing', { waiterCount: activeWaiters.size });
  activeWaiters.clear();
});

/**
 * Get Portal URL with priority:
 * 1. override parameter
 * 2. PARTNER_PORTAL_URL env var
 * 3. ~/.config/pos-cli/config.json partner_portal_url
 * 4. default (partners.platformos.com)
 */
function getPortalUrl(override) {
  if (override) return override;

  if (process.env.PARTNER_PORTAL_URL) {
    return process.env.PARTNER_PORTAL_URL;
  }

  try {
    const config = getPortalConfig();
    if (config.partner_portal_url) {
      return config.partner_portal_url;
    }
  } catch {
    // Config not found, use default
  }
  return DEFAULT_PORTAL_URL;
}

const envAddTool = {
  description: 'Add environment to .pos config. Returns verification URL immediately, spawns background waiter (60s) that saves token when user authorizes.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      environment: {
        type: 'string',
        description: 'Environment name (e.g., staging, production)'
      },
      url: {
        type: 'string',
        description: 'Instance URL (e.g., https://my-app.staging.oregon.platform-os.com)'
      },
      token: {
        type: 'string',
        description: 'Optional: Direct API token (skips device authorization if provided)'
      },
      email: {
        type: 'string',
        description: 'Optional: Email associated with the account'
      },
      partner_portal_url: {
        type: 'string',
        description: 'Optional: Partner Portal URL (reads from ~/.config/pos-cli/config.json if not provided)'
      },
      timeout_seconds: {
        type: 'number',
        description: 'Optional: Max seconds to wait for authorization (default: 60, max: 120)'
      }
    },
    required: ['environment', 'url']
  },

  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    log.info('handler:START', { environment: params.environment, url: params.url, params });

    try {
      const portalUrl = ctx.portalUrl || getPortalUrl(params.partner_portal_url);
      const timeoutSeconds = Math.min(params.timeout_seconds || 60, 120);
      log.debug('handler:config', { portalUrl, timeoutSeconds });

      // Normalize URL (ensure trailing slash)
      let instanceUrl = params.url;
      if (!instanceUrl.endsWith('/')) {
        instanceUrl = instanceUrl + '/';
      }

      // Validate URL format
      let instanceDomain;
      try {
        instanceDomain = new URL(instanceUrl).hostname;
      } catch {
        return {
          ok: false,
          error: { code: 'INVALID_URL', message: `Invalid URL format: ${params.url}` },
          meta: { startedAt, finishedAt: new Date().toISOString() }
        };
      }

      const fetchFn = ctx.fetch || fetch;

      // Direct token provided - skip device auth
      if (params.token) {
        log.info('handler:usingProvidedToken');

        const storeEnvFn = ctx.storeEnvironment || storeEnvironment;
        storeEnvFn({
          environment: params.environment,
          url: instanceUrl,
          token: params.token,
          email: params.email,
          partner_portal_url: portalUrl
        });

        return {
          ok: true,
          data: {
            environment: params.environment,
            url: instanceUrl,
            message: `Environment "${params.environment}" added successfully.`
          },
          meta: { startedAt, finishedAt: new Date().toISOString() }
        };
      }

      // Device authorization flow - get verification URL
      log.info('handler:startingDeviceAuth', { instanceDomain, portalUrl });

      let deviceAuthResponse;
      try {
        const authUrl = `${portalUrl}/oauth/authorize_device`;
        log.debug('handler:requestingDeviceAuth', { authUrl });

        const response = await fetchFn(authUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `domain=${encodeURIComponent(instanceDomain)}`
        });

        if (response.status === 404) {
          return {
            ok: false,
            error: {
              code: 'INSTANCE_NOT_REGISTERED',
              message: `Instance ${instanceUrl} is not registered in the Partner Portal. Verify the URL is correct.`
            },
            meta: { startedAt, finishedAt: new Date().toISOString() }
          };
        }

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Device authorization failed: ${response.status} ${text}`);
        }

        deviceAuthResponse = await response.json();
      } catch (e) {
        return {
          ok: false,
          error: { code: 'DEVICE_AUTH_FAILED', message: String(e.message || e) },
          meta: { startedAt, finishedAt: new Date().toISOString() }
        };
      }

      const verificationUrl = deviceAuthResponse.verification_uri_complete;
      const deviceCode = deviceAuthResponse.device_code;
      const pollInterval = (deviceAuthResponse.interval || 5) * 1000;
      const waiterId = `${params.environment}-${Date.now()}`;

      log.info('handler:deviceAuthSuccess', { verificationUrl, waiterId, pollInterval });

      // Spawn background waiter
      const waiterPromise = spawnBackgroundWaiter({
        waiterId,
        deviceCode,
        portalUrl,
        pollInterval,
        timeoutSeconds,
        environment: params.environment,
        instanceUrl,
        email: params.email,
        fetchFn,
        storeEnvFn: ctx.storeEnvironment || storeEnvironment
      });

      // Store waiter reference
      activeWaiters.set(waiterId, waiterPromise);

      // Log waiter completion (success or failure)
      waiterPromise.then(result => {
        log.info('handler:waiterComplete', { waiterId, result });
        activeWaiters.delete(waiterId);
      }).catch(err => {
        log.error('handler:waiterError', { waiterId, error: err.message });
        activeWaiters.delete(waiterId);
      });

      // Return immediately with verification URL
      return {
        ok: true,
        data: {
          status: 'awaiting_authorization',
          message: `Open the URL below to authorize. Background waiter active for ${timeoutSeconds}s - will save credentials automatically when you authorize.`,
          verification_url: verificationUrl,
          waiter_id: waiterId,
          timeout_seconds: timeoutSeconds
        },
        meta: { startedAt, finishedAt: new Date().toISOString() }
      };

    } catch (e) {
      log.error('handler:error', { error: e.message });
      return {
        ok: false,
        error: { code: 'ENV_ADD_ERROR', message: String(e.message || e) },
        meta: { startedAt, finishedAt: new Date().toISOString() }
      };
    }
  }
};

/**
 * Background waiter that polls for authorization
 */
async function spawnBackgroundWaiter({
  waiterId,
  deviceCode,
  portalUrl,
  pollInterval,
  timeoutSeconds,
  environment,
  instanceUrl,
  email,
  fetchFn,
  storeEnvFn
}) {
  log.info('waiter:start', { waiterId, timeoutSeconds, pollInterval, environment, instanceUrl });

  const pollEndTime = Date.now() + (timeoutSeconds * 1000);

  try {
    let pollCount = 0;
    while (Date.now() < pollEndTime) {
      pollCount++;
      const remaining = Math.ceil((pollEndTime - Date.now()) / 1000);
      log.debug('waiter:poll', { pollCount, remaining, waiterId });
      await sleep(pollInterval);

      // Check if waiter was cancelled
      if (!activeWaiters.has(waiterId)) {
        log.info('waiter:cancelled', { waiterId });
        return { status: 'cancelled' };
      }

      try {
        const tokenUrl = `${portalUrl}/oauth/device_token`;
        log.debug('waiter:fetchingToken', { tokenUrl });
        const tokenResponse = await fetchFn(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=${encodeURIComponent(deviceCode)}`
        });

        log.debug('waiter:tokenResponseStatus', { status: tokenResponse.status });
        const tokenData = await tokenResponse.json();
        log.debug('waiter:tokenData', tokenData);

        if (tokenData.access_token) {
          log.info('waiter:accessTokenReceived');

          try {
            log.debug('waiter:callingStoreEnvironment');
            storeEnvFn({
              environment,
              url: instanceUrl,
              token: tokenData.access_token,
              email,
              partner_portal_url: portalUrl
            });
            log.info('waiter:storeEnvironmentSuccess');
          } catch (e) {
            log.error('waiter:storeEnvironmentError', { error: e.message });
            activeWaiters.delete(waiterId);
            return { status: 'error', error: `Failed to save environment: ${e.message}` };
          }

          activeWaiters.delete(waiterId);
          log.info('waiter:success', { environment });
          return { status: 'success', environment };
        }

        if (tokenData.error === 'authorization_pending') {
          log.debug('waiter:authorizationPending');
          continue;
        }

        if (tokenData.error === 'slow_down') {
          log.warn('waiter:slowDown');
          await sleep(pollInterval);
          continue;
        }

        if (tokenData.error === 'expired_token' || tokenData.error === 'access_denied') {
          log.warn('waiter:authFailed', { error: tokenData.error });
          activeWaiters.delete(waiterId);
          return { status: 'failed', error: tokenData.error };
        }

        log.warn('waiter:unknownError', tokenData.error);

      } catch (e) {
        log.error('waiter:pollError', { error: e.message });
        // Continue polling on network errors
      }
    }

    // Timeout
    log.warn('waiter:timeout', { waiterId });
    activeWaiters.delete(waiterId);
    return { status: 'timeout' };

  } catch (e) {
    log.error('waiter:exception', { error: e.message });
    activeWaiters.delete(waiterId);
    return { status: 'error', error: e.message };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function storeEnvironment(settings) {
  log.debug('storeEnvironment:start', settings);

  // Use .pos file in the directory where MCP server was started
  const configPath = path.join(process.cwd(), '.pos');
  log.debug('storeEnvironment:configPath', { configPath, cwd: process.cwd() });

  let config = {};
  if (fs.existsSync(configPath)) {
    log.debug('storeEnvironment:existingFileFound');
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      log.debug('storeEnvironment:existingConfig', config);
    } catch (e) {
      log.warn('storeEnvironment:parseError', { error: e.message });
    }
  } else {
    log.debug('storeEnvironment:creatingNew');
  }

  config[settings.environment] = {
    url: settings.url,
    token: settings.token,
    email: settings.email,
    partner_portal_url: settings.partner_portal_url
  };

  log.debug('storeEnvironment:newConfig', config);

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    log.info('storeEnvironment:success', { configPath });
  } catch (e) {
    log.error('storeEnvironment:writeError', { error: e.message });
    throw new Error(`Failed to write .pos file: ${e.message}`);
  }
}

export default envAddTool;
