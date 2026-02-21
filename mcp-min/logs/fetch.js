// platformos.logs.fetch tool - batch fetch logs based on pos-cli fetch-logs
import files from '../../lib/files.js';
import { fetchSettings } from '../../lib/settings.js';
import Gateway from '../../lib/proxy.js';

const settings = { fetchSettings };

function maskToken(token) {
  if (!token) return token;
  return token.slice(0, 3) + '...' + token.slice(-3);
}

async function resolveAuth(params) {
  // precedence: explicit params -> MPKIT_* env -> .pos by env -> first .pos
  if (params?.url && params?.email && params?.token) {
    return { url: params.url, email: params.email, token: params.token, source: 'params' };
  }
  const { MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN } = process.env;
  if (MPKIT_URL && MPKIT_EMAIL && MPKIT_TOKEN) {
    return { url: MPKIT_URL, email: MPKIT_EMAIL, token: MPKIT_TOKEN, source: 'env' };
  }
  if (params?.env) {
    const found = await settings.fetchSettings(params.env);
    if (found) return { ...found, source: `.pos(${params.env})` };
  }
  const conf = files.getConfig();
  const firstEnv = conf && Object.keys(conf)[0];
  if (firstEnv) {
    const found = conf[firstEnv];
    if (found) return { ...found, source: `.pos(${firstEnv})` };
  }
  throw new Error('AUTH_MISSING: Provide url,email,token or configure .pos / MPKIT_* env vars');
}

const fetchLogsTool = {
  description: 'Fetch recent logs in batches (NDJSON semantics, returns JSON array here). Mirrors pos-cli fetch-logs.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string' },
      url: { type: 'string' },
      email: { type: 'string' },
      token: { type: 'string' },
      lastId: { type: 'string' },
      endpoint: { type: 'string', description: 'Override API base url' },
      limit: { type: 'integer', minimum: 1, maximum: 10000 }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    const auth = await resolveAuth(params);

    // Allow endpoint override (CLI option --endpoint)
    const baseUrl = params?.endpoint ? params.endpoint : auth.url;

    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    // lastId handling similar to CLI: default '0' if not provided
    let latestId = (params && (params.lastId !== undefined && params.lastId !== null) ? String(params.lastId) : '0');
    let seen = new Set();
    const out = [];
    const maxCount = params?.limit && Number.isFinite(params.limit) ? Number(params.limit) : Infinity;

    while (true) {
      const prevId = latestId;
      const response = await gateway.logs({ lastId: latestId });
      const logs = response && response.logs;
      if (!logs || logs.length === 0) break;

      let maxId = latestId;
      for (let i = 0; i < logs.length; i++) {
        const row = logs[i];
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
        // numeric-only comparison like CLI for safety
        const curr = Number(row.id);
        if (!Number.isNaN(curr)) {
          const prev = Number(maxId);
          if (Number.isNaN(prev) || curr > prev) maxId = String(row.id);
        }
        if (out.length >= maxCount) break;
      }

      if (maxId === prevId) break; // no progress
      latestId = maxId;
      if (out.length >= maxCount) break;
    }

    return {
      logs: out,
      lastId: latestId,
      meta: {
        startedAt,
        finishedAt: new Date().toISOString(),
        count: out.length,
        auth: { url: baseUrl, email: auth.email, token: maskToken(auth.token), source: auth.source }
      }
    };
  }
};

export default fetchLogsTool;
