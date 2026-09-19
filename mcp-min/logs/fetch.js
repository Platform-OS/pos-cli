// platformos.logs.fetch tool - batch fetch logs based on pos-cli fetch-logs
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import { cancelled } from '../cancellation.js';

const fetchLogsTool = {
  description: 'Fetch log rows from an instance. Returns the rows and a lastId; pass that back to get only newer ones.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      lastId: { type: 'integer', minimum: 0, description: 'Resume after this row id.', default: 0 },
      limit: { type: 'integer', minimum: 1, maximum: 10000, description: 'Stop after this many rows.' }
    }
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);

    // The request URL comes from the resolved credentials only (see graphql-exec).
    const baseUrl = auth.url;

    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    // lastId handling similar to CLI: default '0' if not provided
    let latestId = (params && (params.lastId !== undefined && params.lastId !== null) ? String(params.lastId) : '0');
    const seen = new Set();
    const out = [];
    const maxCount = params?.limit && Number.isFinite(params.limit) ? Number(params.limit) : Infinity;

    while (true) {
      if (ctx.signal?.aborted) throw cancelled();
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
      // Number, not the string the paging loop carries: `lastId` is declared as an integer on the
      // way in, and the documented use of this field is to hand it straight back as the next
      // call's cursor.
      lastId: Number(latestId),
      count: out.length
    };
  }
};

export default fetchLogsTool;
