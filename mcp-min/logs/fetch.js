// platformos.logs.fetch tool - batch fetch logs based on pos-cli fetch-logs
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import { cancelled } from '../cancellation.js';
// The cursor's shape, from where the GUI's own logs schema keeps it: the two enforce one type for
// one identifier, which is the property that was claimed while they disagreed.
import { ROW_ID } from '../../lib/validation/schemas/gui.js';

const fetchLogsTool = {
  description: 'Fetch rows from the instance error log — the stream pos-cli logs tails, which does not carry {% log %} output. Reads forward from lastId, oldest first, and returns the next lastId.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      // A row id as the instance writes it: a microsecond epoch, `"1790008926.7639065"`, a string
      // in every row it sends. `integer` rejected that outright and `number` would round it, so the
      // resume this tool documents had no value that worked at all. The shape is the one
      // `logsRequestSchema` (lib/validation/schemas/gui.js) enforces, so the cursor has one type
      // wherever it travels — the property that comment has always claimed and this one broke.
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
    // double holds. `String()` rather than a plain read because the schema is what rejects a
    // non-string, and a handler called directly must not turn a stray number into `"[object ...]"`.
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
      // The string the paging loop carries, and the string the instance gave us. It used to be
      // `Number(latestId)`, which the schema then refused on the way back in — so the resume this
      // tool documents had no correct input at all. Truncating to the integer part is not a
      // workaround either: measured against a live instance, `last_id` is a strict greater-than, so
      // a truncated cursor re-delivers every row from the same second.
      lastId: latestId,
      count: out.length
    };
  }
};

export default fetchLogsTool;
