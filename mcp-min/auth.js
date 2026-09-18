// Shared authentication utilities for mcp-min tools
import files from '../lib/files.js';
import { settingsFromDotPos } from '../lib/settings.js';
import { mask } from './redact.js';

const settings = { settingsFromDotPos };

/**
 * Mask a token for a result returned to the client — `meta.auth.token`, so a caller can tell which
 * credential was used. The log does its own masking (`redact.js`); this is the same rule, imported
 * rather than restated, so the two cannot disagree.
 */
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
 * A named environment beats MPKIT_*, and does not fall back to it: the caller said which
 * instance they meant, so resolving to a different one — silently, because the environment a
 * process inherited happens to name another — would be worse than the error. The order is the
 * contract, not an implementation detail: `mcp-min/__tests__/auth.env-resolve.test.js` pins each
 * step, and checks this list against what the function does.
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

  // Two of the three is a mistake worth reporting: it names an instance and then resolves a
  // different one from `.pos`, so the call would quietly go somewhere the caller did not ask for.
  const explicit = ['url', 'email', 'token'].filter(name => params?.[name]);
  if (explicit.length > 0) {
    const missing = ['url', 'email', 'token'].filter(name => !params?.[name]);
    throw new Error(`Explicit credentials need url, email and token together; missing: ${missing.join(', ')}`);
  }

  // Priority 2: Named .pos environment, read from `.pos` and nowhere else. `fetchSettings` —
  // the CLI's resolver — answers from MPKIT_* first, which meant an MCP client naming an
  // environment got whatever those variables pointed at, reported as the environment it asked
  // for. The CLI keeps that order deliberately (CI exports MPKIT_* and names an environment on
  // the command line); here the name is the instruction, so an unknown one is an error rather
  // than a quiet redirect.
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
