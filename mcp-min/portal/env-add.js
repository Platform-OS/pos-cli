// env-add tool - Add environment using device authorization flow
import { DEBUG, debugLog } from '../config.js';
import { getPortalConfig, portalRequest } from './portal-client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { mkdirSync, appendFileSync } from 'fs';
import { homedir } from 'os';

// Default Partner Portal URL
const DEFAULT_PORTAL_URL = 'https://partners.platformos.com';

// Track active background waiters
const activeWaiters = new Map();

// Logging setup - write to both console and log file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_DIR = path.join(homedir(), '.pos-cli', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'env-add.log');

let logInitialized = false;

function initLog() {
  if (logInitialized) return;
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    logInitialized = true;
  } catch (err) {
    // Silently ignore if we can't create log directory
  }
}

function log(message, data = null) {
  const ts = new Date().toISOString();
  const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  const line = `[${ts}] ${message}${dataStr}`;

  // Write to log file
  initLog();
  try {
    appendFileSync(LOG_FILE, line + '\n');
  } catch (err) {
    // Silently ignore logging errors
  }
}

// Cleanup on process exit
process.on('exit', () => {
  log('Process exit, clearing', { waiterCount: activeWaiters.size });
  activeWaiters.clear();
});

// Handle unhandled promise rejections in background waiters
process.on('unhandledRejection', (reason, promise) => {
  log('Unhandled rejection in background waiter', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  log('Uncaught exception', err.message);
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
    log('handler:START', { environment: params.environment, url: params.url, params });

    try {
      const portalUrl = ctx.portalUrl || getPortalUrl(params.partner_portal_url);
      const timeoutSeconds = Math.min(params.timeout_seconds || 60, 120);
      log('handler:config', { portalUrl, timeoutSeconds });

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
        log('handler:usingProvidedToken');

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
      log('handler:startingDeviceAuth', { instanceDomain, portalUrl });

      let deviceAuthResponse;
      try {
        const authUrl = `${portalUrl}/oauth/authorize_device`;
        log('handler:requestingDeviceAuth', { authUrl });

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

      log('handler:deviceAuthSuccess', { verificationUrl, waiterId, pollInterval });

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
        log('handler:waiterComplete', { waiterId, result });
        activeWaiters.delete(waiterId);
      }).catch(err => {
        log('handler:waiterError', { waiterId, error: err.message });
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
      log('handler:error', { error: e.message });
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
  log('waiter:start', { waiterId, timeoutSeconds, pollInterval, environment, instanceUrl });

  const pollEndTime = Date.now() + (timeoutSeconds * 1000);

  try {
    let pollCount = 0;
    while (Date.now() < pollEndTime) {
      pollCount++;
      const remaining = Math.ceil((pollEndTime - Date.now()) / 1000);
      log('waiter:poll', { pollCount, remaining, waiterId });
      await sleep(pollInterval);

      // Check if waiter was cancelled
      if (!activeWaiters.has(waiterId)) {
        log('waiter:cancelled', { waiterId });
        return { status: 'cancelled' };
      }

      try {
        const tokenUrl = `${portalUrl}/oauth/device_token`;
        log('waiter:fetchingToken', { tokenUrl });
        const tokenResponse = await fetchFn(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=${encodeURIComponent(deviceCode)}`
        });

        log('waiter:tokenResponseStatus', { status: tokenResponse.status });
        const tokenData = await tokenResponse.json();
        log('waiter:tokenData', tokenData);

        if (tokenData.access_token) {
          log('waiter:accessTokenReceived');

          try {
            log('waiter:callingStoreEnvironment');
            storeEnvFn({
              environment,
              url: instanceUrl,
              token: tokenData.access_token,
              email,
              partner_portal_url: portalUrl
            });
            log('waiter:storeEnvironmentSuccess');
          } catch (e) {
            log('waiter:storeEnvironmentError', { error: e.message });
            activeWaiters.delete(waiterId);
            return { status: 'error', error: `Failed to save environment: ${e.message}` };
          }

          activeWaiters.delete(waiterId);
          log('waiter:success', { environment });
          return { status: 'success', environment };
        }

        if (tokenData.error === 'authorization_pending') {
          log('waiter:authorizationPending');
          continue;
        }

        if (tokenData.error === 'slow_down') {
          log('waiter:slowDown');
          await sleep(pollInterval);
          continue;
        }

        if (tokenData.error === 'expired_token' || tokenData.error === 'access_denied') {
          log('waiter:authFailed', { error: tokenData.error });
          activeWaiters.delete(waiterId);
          return { status: 'failed', error: tokenData.error };
        }

        log('waiter:unknownError', tokenData.error);

      } catch (e) {
        log('waiter:pollError', { error: e.message });
        // Continue polling on network errors
      }
    }

    // Timeout
    log('waiter:timeout', { waiterId });
    activeWaiters.delete(waiterId);
    return { status: 'timeout' };

  } catch (e) {
    log('waiter:exception', { error: e.message });
    activeWaiters.delete(waiterId);
    return { status: 'error', error: e.message };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function storeEnvironment(settings) {
  log('storeEnvironment:start', settings);

  // Use .pos file in the directory where MCP server was started
  const configPath = path.join(process.cwd(), '.pos');
  log('storeEnvironment:configPath', { configPath, cwd: process.cwd() });

  let config = {};
  if (fs.existsSync(configPath)) {
    log('storeEnvironment:existingFileFound');
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      log('storeEnvironment:existingConfig', config);
    } catch (e) {
      log('storeEnvironment:parseError', { error: e.message });
    }
  } else {
    log('storeEnvironment:creatingNew');
  }

  config[settings.environment] = {
    url: settings.url,
    token: settings.token,
    email: settings.email,
    partner_portal_url: settings.partner_portal_url
  };

  log('storeEnvironment:newConfig', config);

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    log('storeEnvironment:success', { configPath });
  } catch (e) {
    log('storeEnvironment:writeError', { error: e.message });
    throw new Error(`Failed to write .pos file: ${e.message}`);
  }
}

export default envAddTool;
