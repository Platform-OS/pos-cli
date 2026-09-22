// platformos.logs.fetch tool - batch fetch logs based on pos-cli fetch-logs
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import { cancelled } from '../cancellation.js';
// One pattern for one identifier, shared with the GUI's logs schema so the two cannot drift.
import { ROW_ID } from '../../lib/validation/schemas/gui.js';

/**
 * A row with the two fields that carry nothing taken off it: 16% of a 322-byte row, on a tool whose
 * `limit` goes to 10,000. Per row and only when empty, never by an allowlist — a row that does
 * carry `data`, or that was updated after it was written, keeps both — so nothing the instance
 * meant can be lost.
 */
const lean = (row) => {
  if (row === null || typeof row !== 'object') return row;

  const { data, updated_at: updatedAt, ...rest } = row;
  return {
    ...rest,
    ...(data !== null && data !== undefined && { data }),
    ...(updatedAt !== undefined && updatedAt !== rest.created_at && { updated_at: updatedAt })
  };
};

const fetchLogsTool = {
  description: 'Fetch rows from the instance error log — the stream pos-cli logs tails, which does not carry {% log %} output. Reads forward from lastId, oldest first, and returns the next lastId.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      // A row id as the instance writes it: a microsecond epoch, `"1790008926.7639065"`. `integer`
      // rejected that outright and `number` would round it, so the resume this tool documents had
      // no value that worked at all.
      lastId: { type: 'string', pattern: ROW_ID, description: 'A lastId this tool returned, passed back unchanged; only newer rows come back. Omit for the oldest kept.', default: '0' },
      limit: { type: 'integer', minimum: 1, maximum: 10000, description: 'Stop after this many rows, oldest first.' }
    }
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);

    // The request URL comes from the resolved credentials only (see graphql-exec).
    const baseUrl = auth.url;

    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    // A string from here on, never a number: the ids are microsecond epochs at the edge of what a
    // double holds.
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
      logs: out.map(lean),
      // The string the instance gave us, unchanged: `last_id` is a strict greater-than, so a
      // cursor that lost its fraction re-delivers every row from the same second.
      lastId: latestId,
      count: out.length
    };
  }
};

export default fetchLogsTool;
