// platformos.logs.fetch tool - batch fetch logs based on pos-cli fetch-logs
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import { cancelled } from '../cancellation.js';
import log from '../log.js';
import { ToolError } from '../tool-error.js';
// One pattern and one ordering for one identifier, shared with the GUI's logs schema.
import { ROW_ID, newerOf, cursorForMs, NEWEST_PAGE, OLDEST_RETAINED } from '../../lib/logRowId.js';

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

/**
 * The caller's `since`, as a cursor. The encoding is `lib/logRowId.js`'s, shared with the crash
 * lookup in `tests/crash-check.js`; what stays here is the parse and the refusal, which are this
 * tool's to make.
 *
 * `NEWEST_PAGE` and `OLDEST_RETAINED` come from there too. The difference between them cost an
 * evaluation a search: this tool defaulted to `0` while its schema said "omit for the oldest
 * kept", so a search that passed no `since` looked at twenty rows, answered `count: 0`, and was
 * believed.
 */
const cursorForTime = (since) => {
  const ms = Date.parse(since);
  if (Number.isNaN(ms)) {
    throw ToolError.input('INVALID_SINCE', `since is not a time that can be read: ${since}. Pass an ISO-8601 timestamp, e.g. 2026-09-22T17:16:51Z.`);
  }
  return cursorForMs(ms);
};

/** A row's `message` is sometimes an object, which `pos-cli logs` also renders. */
const asText = (value) => (typeof value === 'string' ? value : (value === undefined || value === null ? '' : JSON.stringify(value)));

/**
 * The newest row the instance holds, whatever was asked for.
 *
 * Asked only when a `since` read came back with nothing, which is the one answer a caller cannot
 * read: an empty result looks the same whether nothing happened in that window or the instance
 * stopped writing to the log days ago. One extra read of the newest page settles it.
 *
 * Not on an empty `lastId` read: that is a tail at the tip of the stream and is empty most times
 * it is called, so the cost would land on the common case and answer a question nobody asked.
 *
 * @returns {Promise<{id: string, created_at?: string}|null>} null when the log holds nothing at all
 */
const newestRowOn = async (gateway) => {
  const response = await gateway.logs({ lastId: NEWEST_PAGE });
  const rows = response?.logs;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  // Oldest first, so the newest is last (measured 2026-09-23).
  const newest = rows[rows.length - 1];
  return { id: String(newest?.id), ...(newest?.created_at && { created_at: newest.created_at }) };
};

const matcherFor = ({ errorType, contains } = {}) => {
  // Substring, not the exact `error_type` equality `pos-cli logs --filter` makes: there
  // `--filter error` misses a row typed `Liquid error`.
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

/**
 * Where to start reading. `since` and `lastId` are refused together rather than resolved by
 * precedence: a caller that passed both meant one of them, and choosing silently starts the read
 * somewhere they did not ask for.
 *
 * With neither, the default is the one thing this tool cannot get from the caller — which of its
 * two jobs this call is. A filter means searching, and a search that does not reach the oldest row
 * reports "no such error" for one that is there; the instance cannot filter, so the scan happens
 * either way and starting at the beginning is what makes its answer true. No filter means looking
 * at the log, where the newest rows are the answer and the whole retained log is not.
 */
const startingCursor = (params, searching) => {
  const since = params?.since;
  const lastId = params?.lastId;
  if (since !== undefined && since !== null && lastId !== undefined && lastId !== null) {
    throw ToolError.input('SINCE_AND_LAST_ID', 'Pass since or lastId, not both: they name different places to start. since is a time; lastId resumes an earlier call.');
  }
  if (since !== undefined && since !== null) return cursorForTime(since);
  if (lastId !== undefined && lastId !== null) return String(lastId);
  return searching ? OLDEST_RETAINED : NEWEST_PAGE;
};

const fetchLogsTool = {
  description: 'Fetch rows from the instance error log, the stream pos-cli logs tails. Deployed code writes here, {% log %} included; a liquid-exec render adds only its Liquid errors, not its {% log %}. Reads forward from lastId or since, oldest first, and returns the next lastId. errorType and contains are matched here, not by the instance, so a narrow search still reads every row. With no lastId or since it starts at the oldest retained row when filtering, and at the newest rows otherwise. A row is readable a few seconds after it is written, so an immediate read can miss it.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      // A row id as the instance writes it: a microsecond epoch, `"1790008926.7639065"`. `integer`
      // rejected that outright and `number` would round it, so the resume this tool documents had
      // no value that worked at all.
      lastId: { type: 'string', pattern: ROW_ID, description: 'A lastId this tool returned, passed back unchanged; only newer rows come back.' },
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
    let latestId = startingCursor(params, matches !== null);
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

    // Only a `since` read that found nothing: see `newestRowOn`.
    const newestRow = (out.length === 0 && params?.since !== undefined && !ctx.signal?.aborted)
      ? await newestRowOn(gateway).catch((err) => {
        // A diagnostic must not turn an empty answer into a failed call.
        log.debug('could not read the newest log row', { error: String(err) });
        return undefined;
      })
      : undefined;

    return {
      logs: out.map(lean),
      // What the instance actually holds, when the answer was otherwise just "nothing". `null`
      // means the log is empty; a timestamp far in the past means it stopped being written to.
      ...(newestRow !== undefined && { newestRow }),
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
