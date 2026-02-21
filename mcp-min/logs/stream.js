// platformos.logs.stream - streaming logs via SSE with polling
import log from '../log.js';
import files from '../../lib/files.js';
import { fetchSettings } from '../../lib/settings.js';
import Gateway from '../../lib/proxy.js';

const settings = { fetchSettings };

async function resolveAuth(params) {
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

function matchesFilter(row, filter) {
  if (!filter) return true;
  const type = (row.error_type || row.type || '').toString().toLowerCase();
  return type.includes(String(filter).toLowerCase());
}

const streamTool = {
  description: 'Real-time log streaming using polling and SSE. Optional filter by type.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string' },
      url: { type: 'string' },
      email: { type: 'string' },
      token: { type: 'string' },
      endpoint: { type: 'string' },
      interval: { type: 'integer', minimum: 250 },
      filter: { type: 'string' },
      startLastId: { type: 'string', description: 'Starting last id (default 0)' },
      maxDuration: { type: 'integer', description: 'Optional max duration ms' }
    }
  },
  streamHandler: async (params, { writer, Gateway: GatewayOverride } = {}) => {
    const auth = await resolveAuth(params);
    const baseUrl = params?.endpoint ? params.endpoint : auth.url;
    const GatewayCtor = GatewayOverride || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    const interval = Number(params?.interval) || 3000;
    const filter = params?.filter;
    let lastId = (params && params.startLastId != null) ? String(params.startLastId) : '0';
    const seen = new Set();
    const started = Date.now();
    const maxDuration = params?.maxDuration && Number(params.maxDuration) > 0 ? Number(params.maxDuration) : null;
    let elapsed = 0;
    let doneTimer = null;
    if (maxDuration) {
      doneTimer = setTimeout(() => {
        try { writer({ event: 'done', data: '' }); } catch (_) {}
      }, maxDuration);
    }

    writer({ event: 'data', data: JSON.stringify({ type: 'info', message: 'logs.stream started', env: params?.env || auth.source, interval }) });

    const tick = async () => {
      try {
        const resp = await gateway.logs({ lastId });
        const list = (resp && resp.logs) || [];
        if (list.length > 0) {
          let maxId = lastId;
          for (const row of list) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            if (matchesFilter(row, filter)) {
              writer({ event: 'data', data: JSON.stringify(row) });
            }
            const curr = Number(row.id);
            if (!Number.isNaN(curr)) {
              const prev = Number(maxId);
              if (Number.isNaN(prev) || curr > prev) maxId = String(row.id);
            }
          }
          lastId = maxId;
        }
      } catch (e) {
        writer({ event: 'error', data: String(e) });
      }
    };

    let timer = null;
    const schedule = () => {
      timer = setTimeout(async function run() {
        await tick();
        if (maxDuration) {
          elapsed += interval;
          if (elapsed >= maxDuration) {
            writer({ event: 'done', data: '' });
            return;
          }
        }
        schedule();
      }, interval);
    };

    // initial tick immediately
    await tick();
    schedule();

    // return a promise that never resolves; http-server will end when streamHandler resolves/rejects
    return new Promise(() => {});
  }
};

export default streamTool;
