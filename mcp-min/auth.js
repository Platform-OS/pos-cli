// Shared authentication utilities for mcp-min tools
import files from '../lib/files.js';
import { fetchSettings } from '../lib/settings.js';

const settings = { fetchSettings };

/**
 * Mask a token for safe logging.
 */
export function maskToken(token) {
  if (!token) return token;
  return token.slice(0, 3) + '...' + token.slice(-3);
}

/**
 * Resolve authentication from params, falling back through:
 *   1. Explicit params (url + email + token)
 *   2. MPKIT_* environment variables
 *   3. Named .pos environment (params.env)
 *   4. First environment in .pos config
 *
 * @param {object} params - Tool input params
 * @param {object} [ctx] - Optional context for dependency injection in tests
 * @param {object} [ctx.settings] - Override settings module
 * @param {object} [ctx.files] - Override files module
 * @returns {Promise<{url, email, token, source}>}
 */
export async function resolveAuth(params, ctx = {}) {
  const settingsModule = ctx.settings || settings;
  const filesModule = ctx.files || files;

  // Priority 1: Explicit params
  if (params?.url && params?.email && params?.token) {
    return { url: params.url, email: params.email, token: params.token, source: 'params' };
  }

  // Priority 2: Named .pos environment. When an env name is given we resolve it
  // directly without falling back to MPKIT_* — the caller is being explicit.
  if (params?.env) {
    const found = await settingsModule.fetchSettings(params.env);
    if (found) return { ...found, source: `.pos(${params.env})` };
    throw new Error(`Environment '${params.env}' not found in .pos config`);
  }

  // Priority 3: MPKIT_* environment variables
  const { MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN } = process.env;
  if (MPKIT_URL && MPKIT_EMAIL && MPKIT_TOKEN) {
    return { url: MPKIT_URL, email: MPKIT_EMAIL, token: MPKIT_TOKEN, source: 'env' };
  }

  // Priority 4: First environment in .pos config
  const conf = filesModule.getConfig();
  const firstEnv = conf && Object.keys(conf)[0];
  if (firstEnv && conf[firstEnv]) {
    return { ...conf[firstEnv], source: `.pos(${firstEnv})` };
  }

  throw new Error('AUTH_MISSING: Provide url,email,token or configure .pos / MPKIT_* env vars');
}

/**
 * Run an async function with MARKETPLACE_* environment variables set from auth,
 * restoring the original values afterwards.
 *
 * NOTE: This is not concurrency-safe. The MCP server is a local development tool
 * and concurrent tool invocations that both mutate env vars can interfere.
 * Prefer passing auth directly to lib functions where possible.
 *
 * @param {{url, email, token}} auth
 * @param {Function} fn - Async function to run with env vars set
 * @returns {Promise<*>}
 */
export async function runWithAuth(auth, fn) {
  const saved = {
    MARKETPLACE_URL: process.env.MARKETPLACE_URL,
    MARKETPLACE_TOKEN: process.env.MARKETPLACE_TOKEN,
    MARKETPLACE_EMAIL: process.env.MARKETPLACE_EMAIL
  };

  process.env.MARKETPLACE_URL = auth.url;
  process.env.MARKETPLACE_TOKEN = auth.token;
  process.env.MARKETPLACE_EMAIL = auth.email;

  try {
    return await fn();
  } finally {
    if (saved.MARKETPLACE_URL !== undefined) {
      process.env.MARKETPLACE_URL = saved.MARKETPLACE_URL;
    } else {
      delete process.env.MARKETPLACE_URL;
    }
    if (saved.MARKETPLACE_TOKEN !== undefined) {
      process.env.MARKETPLACE_TOKEN = saved.MARKETPLACE_TOKEN;
    } else {
      delete process.env.MARKETPLACE_TOKEN;
    }
    if (saved.MARKETPLACE_EMAIL !== undefined) {
      process.env.MARKETPLACE_EMAIL = saved.MARKETPLACE_EMAIL;
    } else {
      delete process.env.MARKETPLACE_EMAIL;
    }
  }
}
