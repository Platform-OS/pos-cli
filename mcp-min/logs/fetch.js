// platformos.logs.fetch tool - batch fetch logs based on pos-cli fetch-logs
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import { cancelled } from '../cancellation.js';
import { ToolError } from '../tool-error.js';
// One pattern and one ordering for one identifier, shared with the GUI's logs schema.
import { ROW_ID, newerOf } from '../../lib/logRowId.js';

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

// `/logs` cannot filter (measured 2026-09-22), so a filter that matches little pages until it has
// enough. The most rows one call reads; the same ceiling as `limit`'s maximum.
export const MAX_SCAN = 10000;

// A row id is a microsecond epoch of the instant `created_at` names, so a time is a cursor the
// instance itself skips by. Built from integer milliseconds: dividing would round.
const cursorForTime = (since) => {
  const ms = Date.parse(since);
  if (Number.isNaN(ms)) {
    throw ToolError.input('INVALID_SINCE', `since is not a time that can be read: ${since}. Pass an ISO-8601 timestamp, e.g. 2026-09-22T17:16:51Z.`);
  }
  if (ms <= 0) return '0';

  const seconds = Math.floor(ms / 1000);
  return `${seconds}.${String(ms - seconds * 1000).padStart(3, '0')}`;
};

/** A row's `message` is sometimes an object, which `pos-cli logs` also renders. */
const asText = (value) => (typeof value === 'string' ? value : (value === undefined || value === null ? '' : JSON.stringify(value)));

// Substring, not the exact `error_type` equality `pos-cli logs --filter` makes: there
// `--filter error` misses a row typed `Liquid error`. `null` when nothing was asked for.
const matcherFor = ({ errorType, contains } = {}) => {
  const type = errorType?.toLowerCase();
  const text = contains?.toLowerCase();
  if (!type && !text) return null;

  return (row) => {
    if (row === null || typeof row !== 'object') return false;
    if (type && !asText(row.error_type).toLowerCase().includes(type)) return false;
    if (text && !asText(row.message).toLowerCase().includes(text)) return false;
    return true;
  };
};

// Refused together rather than resolved by precedence: a caller that passed both meant one of
// them, and choosing silently starts the read somewhere they did not ask for.
const startingCursor = (params) => {
  const since = params?.since;
  const lastId = params?.lastId;
  if (since !== undefined && since !== null && lastId !== undefined && lastId !== null) {
    throw ToolError.input('SINCE_AND_LAST_ID', 'Pass since or lastId, not both: they name different places to start. since is a time; lastId resumes an earlier call.');
  }
  if (since !== undefined && since !== null) return cursorForTime(since);
  return lastId !== undefined && lastId !== null ? String(lastId) : '0';
};

const fetchLogsTool = {
  description: 'Fetch rows from the instance error log, the stream pos-cli logs tails. Deployed code writes here, {% log %} included; a liquid-exec render adds only its Liquid errors, not its {% log %}. Reads forward from lastId or since, oldest first, and returns the next lastId. errorType and contains are matched here, not by the instance, so a narrow search still reads every row.',
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
      since: { type: 'string', format: 'date-time', description: 'ISO-8601 time to read from; use instead of lastId, never with it.' },
      errorType: { type: 'string', minLength: 1, description: 'Keep rows whose error_type contains this, ignoring case.' },
      contains: { type: 'string', minLength: 1, description: 'Keep rows whose message contains this, ignoring case.' },
      limit: { type: 'integer', minimum: 1, maximum: 10000, description: 'Stop after this many matching rows, oldest first.' }
    }
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);

    // The request URL comes from the resolved credentials only (see graphql-exec).
    const baseUrl = auth.url;

    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    const matches = matcherFor(params);
    // A string from here on, never a number: the ids are microsecond epochs at the edge of what a
    // double holds.
    let latestId = startingCursor(params);
    const seen = new Set();
    const out = [];
    const maxCount = Number.isFinite(params?.limit) ? params.limit : Infinity;
    let scanned = 0;

    while (scanned < MAX_SCAN && out.length < maxCount) {
      if (ctx.signal?.aborted) throw cancelled();
      const prevId = latestId;
      const response = await gateway.logs({ lastId: latestId });
      const logs = response && response.logs;
      if (!logs || logs.length === 0) break;

      let maxId = latestId;
      for (let i = 0; i < logs.length; i++) {
        const row = logs[i];
        // Optional: a row that is not an object reaches here, and `null.id` would throw before the
        // guards in `matcherFor` and `lean` — which both already expect one — could run.
        const id = row?.id;
        if (seen.has(id)) continue;
        seen.add(id);
        scanned += 1;

        // Over every row read, not only the ones returned, or a filtered read resumes in front of
        // the rows it rejected.
        maxId = newerOf(maxId, id);

        if (!matches || matches(row)) out.push(row);
        if (out.length >= maxCount || scanned >= MAX_SCAN) break;
      }

      if (maxId === prevId) break; // no progress
      latestId = maxId;
    }

    return {
      logs: out.map(lean),
      // The string the instance gave us, unchanged: `last_id` is a strict greater-than, so a
      // cursor that lost its fraction re-delivers every row from the same second.
      lastId: latestId,
      count: out.length,
      // Without a filter every row read is a row returned, so it would say nothing.
      ...(matches && { scanned }),
      // "Nothing matched" and "stopped looking" are different answers. Only when the bound, rather
      // than `limit`, is what ended the read.
      ...(scanned >= MAX_SCAN && out.length < maxCount && { scanLimitReached: true })
    };
  }
};

export default fetchLogsTool;
