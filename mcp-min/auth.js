// Shared authentication utilities for mcp-min tools
import files from '../lib/files.js';
import { settingsFromDotPos } from '../lib/settings.js';
import { mask } from './redact.js';

const settings = { settingsFromDotPos };

/** For `meta.auth.token`, so a caller can tell which credential was used. The log's rule, imported
 * rather than restated, so the two cannot disagree. */
export function maskToken(token) {
  if (!token) return token;
  return mask(token);
}

/**
 * Resolve authentication from params, falling back through:
 *   1. Explicit params (url + email + token)
 *   2. Named .pos environment (params.env)
 *   3. MPKIT_* environment variables
 *   4. First environment in .pos config
 *
 * A named environment beats MPKIT_* and does not fall back to it: the caller said which instance
 * they meant. The order is the contract — `__tests__/auth.env-resolve.test.js` pins each step and
 * checks this list against what the function does.
 *
 * @returns {Promise<{url, email, token, source}>}
 */
export async function resolveAuth(params, ctx = {}) {
  const settingsModule = ctx.settings || settings;
  const filesModule = ctx.files || files;

  // Priority 1: Explicit params
  if (params?.url && params?.email && params?.token) {
    return { url: params.url, email: params.email, token: params.token, source: 'params' };
  }

  // Two of the three would otherwise name one instance and resolve a different one from `.pos`.
  const explicit = ['url', 'email', 'token'].filter(name => params?.[name]);
  if (explicit.length > 0) {
    const missing = ['url', 'email', 'token'].filter(name => !params?.[name]);
    throw new Error(`Explicit credentials need url, email and token together; missing: ${missing.join(', ')}`);
  }

  // Priority 2: read from `.pos` and nowhere else. `fetchSettings`, the CLI's resolver, answers
  // from MPKIT_* first — deliberately, since CI exports those and names an environment on the
  // command line — but here the name is the instruction, so an unknown one is an error rather
  // than a quiet redirect to whatever those variables point at.
  if (params?.env) {
    const found = settingsModule.settingsFromDotPos(params.env);
    if (found?.url && found?.token) return { ...found, source: `.pos(${params.env})` };
    if (found) throw new Error(`Environment '${params.env}' in .pos has no url and token`);
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
  if (firstEnv && conf[firstEnv]?.url && conf[firstEnv]?.token) {
    return { ...conf[firstEnv], source: `.pos(${firstEnv})` };
  }

  throw new Error('AUTH_MISSING: Provide url,email,token or configure .pos / MPKIT_* env vars');
}

/**
 * Run an async function with MARKETPLACE_* set from auth, restoring the originals afterwards.
 *
 * Not concurrency-safe: two tool calls that both do this can interfere. Prefer passing auth
 * directly to lib functions where possible.
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
