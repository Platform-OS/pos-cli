// Shared Portal API client for Partner Portal interactions
// Reads configuration from ~/.config/pos-cli/config.json
import fs from 'fs';
import path from 'path';
import os from 'os';
import log from '../log.js';

/**
 * Get Portal configuration from ~/.config/pos-cli/config.json
 * @returns {{ master_token: string, partner_portal_url: string }}
 */
function getPortalConfig() {
  const configPath = path.join(os.homedir(), '.config', 'pos-cli', 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Portal config not found at ${configPath}. Run 'pos-cli env add' to configure.`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config.master_token) {
    throw new Error('master_token not found in Portal config');
  }
  if (!config.partner_portal_url) {
    throw new Error('partner_portal_url not found in Portal config');
  }
  return config;
}

/**
 * Make an authenticated request to the Partner Portal API
 * @param {Object} options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {string} options.path - API path (e.g., '/api/partners')
 * @param {Object} [options.body] - Request body (will be JSON stringified)
 * @param {string} [options.token] - Override token (defaults to master_token from config)
 * @param {string} [options.baseUrl] - Override base URL (defaults to partner_portal_url from config)
 * @param {Object} [options.config] - Override full config (for testing)
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function portalRequest({ method = 'GET', path: apiPath, body, token, baseUrl, config }) {
  const cfg = config || getPortalConfig();
  const url = `${baseUrl || cfg.partner_portal_url}${apiPath}`;
  const authToken = token || cfg.master_token;

  log.debug('portal:request', { method, url, hasBody: !!body });

  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  log.debug('portal:response', { status: response.status, statusText: response.statusText });

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`Portal API error: ${response.status} ${response.statusText}`);
      error.status = response.status;
      error.body = text;
      throw error;
    }
    return { raw: text };
  }

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || data.message || `Portal API error: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export { getPortalConfig, portalRequest };
