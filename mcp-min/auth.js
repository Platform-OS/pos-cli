// Shared authentication utilities for mcp-min tools
import files from '../lib/files.js';
import { settingsFromDotPos } from '../lib/settings.js';
import { mask } from './redact.js';
import { ToolError } from './tool-error.js';

const settings = { settingsFromDotPos };

/** For `meta.auth.token`, so a caller can tell which credential was used. The log's rule, imported
 * rather than restated, so the two cannot disagree. */
export function maskToken(token) {
  if (!token) return token;
  return mask(token);
}

/** The `source` a resolved `.pos` environment carries, and the name inside it. */
const DOT_POS_SOURCE = /^\.pos\((.+)\)$/;

/**
 * How a rejected stored token is fixed. Only for a `.pos` credential, the only one the command
 * rewrites: explicit params came from the caller and `MPKIT_*` is the server's own environment.
 *
 * `runBy` is part of the advice — without it an agent holding a shell runs the command itself and
 * hangs on its password prompt, which is why `refresh-token` is not an MCP tool.
 *
 * @returns {{command: string, runBy: string}|undefined}
 */
export function refreshTokenRemedy(auth) {
  const env = DOT_POS_SOURCE.exec(auth?.source ?? '')?.[1];
  if (!env) return undefined;

  return {
    command: `pos-cli env refresh-token ${env}`,
    runBy: 'a person at a terminal: it asks for a password and a second factor'
  };
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
 * `ctx.mayChangeInstance` guards step 4 only (see `requireNamedInstance`). `runTool` sets it from
 * the tool's own annotations, so no tool decides this for itself.
 *
 * @returns {Promise<{url, email, token, source}>}
 */
export async function resolveAuth(params, ctx = {}) {
  const auth = await resolve(params, ctx);
  // `runTool` builds meta.auth from this. Recording it here is what lets a tool stop assembling
  // the same masked block itself, and keeps it out of the thirteen that used to.
  ctx.resolvedAuth = auth;
  return auth;
}

async function resolve(params, ctx) {
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
    throw ToolError.input('INCOMPLETE_CREDENTIALS', `Explicit credentials need url, email and token together; missing: ${missing.join(', ')}`);
  }

  // Priority 2: read from `.pos` and nowhere else. `fetchSettings`, the CLI's resolver, answers
  // from MPKIT_* first — deliberately, since CI exports those and names an environment on the
  // command line — but here the name is the instruction, so an unknown one is an error rather
  // than a quiet redirect to whatever those variables point at.
  if (params?.env) {
    const found = settingsModule.settingsFromDotPos(params.env);
    if (found?.url && found?.token) return { ...found, source: `.pos(${params.env})` };
    // The entry is there but unusable: the file needs fixing, which is not something the caller
    // can do by changing an argument.
    if (found) throw ToolError.project('ENV_INCOMPLETE', `Environment '${params.env}' in .pos has no url and token`);
    throw envNotFound(params.env, filesModule);
  }

  // Priority 3: MPKIT_* environment variables
  const { MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN } = process.env;
  if (MPKIT_URL && MPKIT_EMAIL && MPKIT_TOKEN) {
    return { url: MPKIT_URL, email: MPKIT_EMAIL, token: MPKIT_TOKEN, source: 'env' };
  }

  // Priority 4: First environment in .pos config
  const conf = filesModule.getConfig();
  const names = conf ? Object.keys(conf) : [];
  const firstEnv = names[0];
  if (firstEnv && conf[firstEnv]?.url && conf[firstEnv]?.token) {
    requireNamedInstance(ctx, names, firstEnv);
    return { ...conf[firstEnv], source: `.pos(${firstEnv})` };
  }

  throw ToolError.auth('AUTH_MISSING', 'Provide url, email and token, or configure .pos / MPKIT_* environment variables');
}

// Already the error path: an unreadable `.pos` has no names to offer, which is where an empty one
// leaves us too, and neither may replace the error the caller can actually act on.
function readConfig(filesModule) {
  try {
    return filesModule?.getConfig?.() || {};
  } catch {
    return {};
  }
}

/**
 * A name that is not in `.pos`, answered with the names that are: the model cannot read the file,
 * and `ENV_REQUIRED` already answers this way.
 *
 * A remedy only when there is nothing to choose between — with environments configured the list is
 * the fix, and a remedy on every typo is how a field an agent should act on becomes one it skips.
 */
function envNotFound(name, filesModule) {
  const configured = Object.keys(readConfig(filesModule));
  if (configured.length > 0) {
    return ToolError.not_found(
      'ENV_NOT_FOUND',
      `Environment '${name}' is not in .pos. Configured: ${configured.join(', ')}.`,
      { environments: configured }
    );
  }

  return ToolError.not_found('ENV_NOT_FOUND', `Environment '${name}' is not in .pos, which has no environments configured.`, {
    environments: [],
    remedy: {
      command: `pos-cli env add ${name} --url <instance url>`,
      runBy: 'a person at a terminal: it needs the instance URL and a browser sign-in'
    }
  });
}

/**
 * The one resolution step that is a guess, refused for a tool that is not `readOnlyHint`.
 *
 * Steps 1 to 3 all name an instance — in the arguments, in `.pos` by name, or in the environment
 * a CI job exported — and are untouched. Step 4 names nothing: it takes whichever entry happens to
 * be first in a file the model has never seen. For a tool that only reads, that is an
 * inconvenience; for one that writes it is the wrong instance changed, silently.
 *
 * `readOnlyHint` is a wider net than "changes an instance": it promises a tool changes nothing
 * locally either (`tools.js`), so a tool that only writes a local file while reading an instance is
 * refused too. That is the safe direction and costs nothing today — every tool that calls
 * `resolveAuth` does reach an instance — and it is what `runTool` can decide from the registry
 * without a second annotation to keep in step.
 *
 * Why not `required: env` in the schemas, which would be simpler: `resolveAuth` has four supported
 * call styles and only one of them passes `env`, so requiring it would reject explicit credentials,
 * `MPKIT_*` and the single-environment default alike. The ambiguity is not "no env was passed", it
 * is "nothing at all said which instance", and only this function can tell the two apart.
 *
 * One environment is not a guess, so it is allowed: a project with a single `.pos` entry has
 * nothing to choose between, and demanding a name there would be ceremony.
 *
 * `input`, because the caller fixes it by adding an argument — and the message says which, since a
 * model cannot read `.pos`.
 */
function requireNamedInstance(ctx, names, firstEnv) {
  if (!ctx?.mayChangeInstance || names.length < 2) return;

  throw ToolError.input(
    'ENV_REQUIRED',
    `This call can change an instance and nothing said which one. Pass env — one of: ${names.join(', ')}. `
      + `Without it the call would have gone to ${firstEnv}, only because it is first in .pos.`,
    { environments: names, wouldHaveUsed: firstEnv }
  );
}

/**
 * Run an async function with MARKETPLACE_* set from auth, restoring the originals afterwards.
 *
 * Not concurrency-safe, and this server is concurrent: the variables are process-wide, so two
 * overlapping calls restore each other's values. Pass auth to the lib function instead —
 * `presignUrl`/`presignDirectory` and `lib/assets.js` take it. `sync-file` is the only caller
 * left and should stay the last.
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
