// platformos.logs.fetch tool - batch fetch logs based on pos-cli fetch-logs
import { resolveAuth, maskToken } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import { cancelled } from '../cancellation.js';

const fetchLogsTool = {
  description: 'Fetch recent logs in batches (NDJSON semantics, returns JSON array here). Mirrors pos-cli fetch-logs.',
  // Tells MCP clients this tool changes nothing, locally or on the instance.
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string' },
      ...authProperties,
      lastId: { type: 'integer', minimum: 0, description: 'Log row id to resume from (default 0)' },
      limit: { type: 'integer', minimum: 1, maximum: 10000 }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();

    try {
      const auth = await resolveAuth(params, ctx);

      // The request URL comes from the resolved credentials only: an `endpoint` argument used to
      // replace it while the .pos token was still sent, so a caller could name any host and be
      // handed this machine's token.
      const baseUrl = auth.url;

      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

      // lastId handling similar to CLI: default '0' if not provided
      let latestId = (params && (params.lastId !== undefined && params.lastId !== null) ? String(params.lastId) : '0');
      let seen = new Set();
      const out = [];
      const maxCount = params?.limit && Number.isFinite(params.limit) ? Number(params.limit) : Infinity;

      while (true) {
        if (ctx.signal?.aborted) return cancelled();
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
        ok: true,
        logs: out,
        // Number, not the string the paging loop carries: `lastId` is declared as an
        // integer on the way in, and the documented use of this field is to hand it
        // straight back as the next call's cursor.
        lastId: Number(latestId),
        meta: {
          startedAt,
          finishedAt: new Date().toISOString(),
          count: out.length,
          auth: { url: baseUrl, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };
    } catch (e) {
      return {
        ok: false,
        error: { code: 'LOGS_FETCH_ERROR', message: String(e.message || e) }
      };
    }
  }
};

export default fetchLogsTool;
