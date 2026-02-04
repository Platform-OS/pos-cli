// env-add tool - Add environment using device authorization flow
import { DEBUG, debugLog } from '../config.js';
import { getPortalConfig, portalRequest } from './portal-client.js';
import fs from 'fs';
import path from 'path';

// Default Partner Portal URL
const DEFAULT_PORTAL_URL = 'https://partners.platformos.com';

// Track active background waiters
const activeWaiters = new Map();

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
    DEBUG && debugLog('tool:env-add invoked', { environment: params.environment, url: params.url });

    try {
      const portalUrl = ctx.portalUrl || getPortalUrl(params.partner_portal_url);
      DEBUG && debugLog('env-add: using portal URL', { portalUrl });
      const timeoutSeconds = Math.min(params.timeout_seconds || 60, 120);

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
        DEBUG && debugLog('env-add: using provided token');

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
      DEBUG && debugLog('env-add: starting device authorization', { instanceDomain, portalUrl });

      let deviceAuthResponse;
      try {
        const authUrl = `${portalUrl}/oauth/authorize_device`;
        DEBUG && debugLog('env-add: requesting device auth', { authUrl });

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

      DEBUG && debugLog('env-add: spawning background waiter', { waiterId, verificationUrl, deviceCode });

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
      DEBUG && debugLog('env-add: error', { error: e.message });
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
  DEBUG && debugLog('background-waiter: started', { waiterId, timeoutSeconds });

  const pollEndTime = Date.now() + (timeoutSeconds * 1000);

  try {
    while (Date.now() < pollEndTime) {
      await sleep(pollInterval);

      // Check if waiter was cancelled
      if (!activeWaiters.has(waiterId)) {
        DEBUG && debugLog('background-waiter: cancelled', { waiterId });
        return { status: 'cancelled' };
      }

      try {
        const tokenUrl = `${portalUrl}/oauth/device_token`;
        const tokenResponse = await fetchFn(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=${encodeURIComponent(deviceCode)}`
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.access_token) {
          DEBUG && debugLog('background-waiter: received token, saving environment', { waiterId, environment });

          // Save to .pos
          storeEnvFn({
            environment,
            url: instanceUrl,
            token: tokenData.access_token,
            email,
            partner_portal_url: portalUrl
          });

          activeWaiters.delete(waiterId);
          DEBUG && debugLog('background-waiter: success', { waiterId, environment });
          return { status: 'success', environment };
        }

        if (tokenData.error === 'authorization_pending') {
          DEBUG && debugLog('background-waiter: pending', { waiterId, remaining: Math.ceil((pollEndTime - Date.now()) / 1000) });
          continue;
        }

        if (tokenData.error === 'slow_down') {
          await sleep(pollInterval);
          continue;
        }

        if (tokenData.error === 'expired_token' || tokenData.error === 'access_denied') {
          DEBUG && debugLog('background-waiter: auth failed', { waiterId, error: tokenData.error });
          activeWaiters.delete(waiterId);
          return { status: 'failed', error: tokenData.error };
        }

      } catch (e) {
        DEBUG && debugLog('background-waiter: poll error', { waiterId, error: e.message });
        // Continue polling on network errors
      }
    }

    // Timeout
    DEBUG && debugLog('background-waiter: timeout', { waiterId });
    activeWaiters.delete(waiterId);
    return { status: 'timeout' };

  } catch (e) {
    DEBUG && debugLog('background-waiter: exception', { waiterId, error: e.message });
    activeWaiters.delete(waiterId);
    return { status: 'error', error: e.message };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function storeEnvironment(settings) {
  // Find .pos file (look in cwd and parents)
  let configPath = findConfigFile() || path.join(process.cwd(), '.pos');

  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      // Invalid JSON, start fresh
    }
  }

  config[settings.environment] = {
    url: settings.url,
    token: settings.token,
    email: settings.email,
    partner_portal_url: settings.partner_portal_url
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  DEBUG && debugLog('env-add: stored environment', { configPath, environment: settings.environment });
}

function findConfigFile() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    const configPath = path.join(dir, '.pos');
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    dir = path.dirname(dir);
  }
  return null;
}

export default envAddTool;
