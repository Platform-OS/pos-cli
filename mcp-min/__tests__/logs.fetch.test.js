/**
 * `logs-fetch`, and the resume it documents.
 *
 * A row id is a microsecond epoch — `"1790008926.7639065"`, a string in every row the instance
 * sends. The tool returned it as `Number(...)` while its schema declared `lastId` an integer, so
 * three types described one identifier and **no value satisfied the round trip**: the float was
 * rejected as "must be integer", and truncating it to `1790008926` was accepted and re-delivered
 * every row from that second. Measured against a live instance on 2026-09-22: `last_id` is a
 * strict greater-than and takes the full float, so the fix is to stop converting it.
 *
 * Every call below goes through `rejectionFor` first, which is the gate `tools/call` puts in front
 * of a handler on both transports. `runTool` does not validate, so a test that skipped it would
 * have passed on the broken schema.
 */
import { describe, test, expect } from 'vitest';
import { runTool } from '../run-tool.js';
import { rejectionFor } from '../validate-params.js';
import tool, { MAX_SCAN } from '../logs/fetch.js';

const AUTH = { url: 'https://x.example.com', email: 'e@example.com', token: 't' };

/** What a client does: validate against the published schema, then call. */
const callAsClient = async (params, Gateway) => {
  const rejection = rejectionFor('logs-fetch', tool, { ...AUTH, ...params });
  if (rejection) return { rejected: rejection };
  return runTool(tool, { ...AUTH, ...params }, { Gateway });
};

/**
 * Compares two ids exactly, the way the instance does and `Number` cannot: an id has more
 * significant digits than a double holds, so a comparison that parses them can call two different
 * rows equal.
 */
const after = (id, cursor) => {
  const [leftWhole, leftFraction = ''] = String(id).split('.');
  const [rightWhole, rightFraction = ''] = String(cursor).split('.');
  if (leftWhole.length !== rightWhole.length) return leftWhole.length > rightWhole.length;
  if (leftWhole !== rightWhole) return leftWhole > rightWhole;

  const width = Math.max(leftFraction.length, rightFraction.length);
  return leftFraction.padEnd(width, '0') > rightFraction.padEnd(width, '0');
};

/**
 * An instance holding `rows`, answering `last_id` as a strict greater-than and a page at a time.
 * Recording the cursors it was asked for, since that is where a converted id shows up.
 */
const instanceWith = (rows, { pageSize = 50 } = {}) => {
  const asked = [];
  class Instance {
    async logs({ lastId }) {
      asked.push(lastId);
      return { logs: rows.filter(row => after(row.id, lastId)).slice(0, pageSize) };
    }
  }
  return { Gateway: Instance, asked };
};

// Two rows inside the same second, which is what makes a truncated cursor observable: a resume at
// `1790008926` re-delivers both, and one at `1790008927` skips both.
const SAME_SECOND = [
  { id: '1790008519.397928', message: 'first' },
  { id: '1790008926.7639065', message: 'second' },
  { id: '1790008926.9111111', message: 'third' }
];

describe('the lastId this tool returns is one it accepts back', () => {
  test('it comes back as the string the instance sent, not a number', async () => {
    const res = await callAsClient({}, instanceWith(SAME_SECOND).Gateway);

    expect(res.data.lastId).toBe('1790008926.9111111');
  });

  // The whole defect in one assertion: the published schema has to accept the published value.
  test('the published schema accepts it unchanged', async () => {
    const res = await callAsClient({}, instanceWith(SAME_SECOND).Gateway);

    expect(rejectionFor('logs-fetch', tool, { ...AUTH, lastId: res.data.lastId })).toBeNull();
  });

  // Paging is the documented use, so the cursor has to survive the gate in the middle of it.
  test('resuming from it returns nothing, because nothing is newer', async () => {
    const first = await callAsClient({}, instanceWith(SAME_SECOND).Gateway);

    const second = await callAsClient({ lastId: first.data.lastId }, instanceWith(SAME_SECOND).Gateway);

    expect(second.rejected).toBeUndefined();
    expect(second.data.logs).toEqual([]);
    expect(second.data.lastId).toBe(first.data.lastId);
  });
});

/**
 * AC #2, and the reason the type matters at all: a cursor that has lost its fraction cannot
 * separate two rows written in the same second.
 */
describe('paging twice neither repeats a row nor skips one', () => {
  const idsOf = (res) => res.data.logs.map(row => row.id);

  test('the second page carries on exactly where the first stopped', async () => {
    const first = await callAsClient({ limit: 2 }, instanceWith(SAME_SECOND).Gateway);
    expect(idsOf(first)).toEqual(['1790008519.397928', '1790008926.7639065']);

    const second = await callAsClient({ lastId: first.data.lastId }, instanceWith(SAME_SECOND).Gateway);

    expect(idsOf(second)).toEqual(['1790008926.9111111']);
  });

  test('every row is delivered once across the two pages', async () => {
    const first = await callAsClient({ limit: 2 }, instanceWith(SAME_SECOND).Gateway);
    const second = await callAsClient({ lastId: first.data.lastId }, instanceWith(SAME_SECOND).Gateway);

    const delivered = [...idsOf(first), ...idsOf(second)];
    expect(delivered).toEqual(SAME_SECOND.map(row => row.id));
    expect(new Set(delivered).size).toBe(delivered.length);
  });

  // What the caller used to be left with. Kept as a test so the two halves of the defect — the
  // value that was refused and the value that was accepted — are both pinned.
  test('the truncated cursor that used to be the only accepted one repeats a row', async () => {
    const first = await callAsClient({ limit: 2 }, instanceWith(SAME_SECOND).Gateway);
    const truncated = String(Math.trunc(Number(first.data.lastId)));

    const second = await callAsClient({ lastId: truncated }, instanceWith(SAME_SECOND).Gateway);

    expect(idsOf(second)).toContain('1790008926.7639065');
    expect(idsOf(first)).toContain('1790008926.7639065');
  });

  /**
   * Not every instance treats `last_id` as exclusive — this one answers inclusively, so each page
   * repeats the row the cursor names. Paging alone would hand that row over twice; the call keeps
   * the ids it has already delivered, which is the same guard `pos-cli logs` has always had.
   */
  test('a page that overlaps the one before it still delivers each row once', async () => {
    class Inclusive {
      async logs({ lastId }) {
        const from = SAME_SECOND.findIndex(row => !after(lastId, row.id));
        return { logs: SAME_SECOND.slice(from === -1 ? SAME_SECOND.length : from, (from === -1 ? 0 : from) + 2) };
      }
    }

    const res = await callAsClient({}, Inclusive);

    expect(res.data.logs.map(row => row.id)).toEqual(SAME_SECOND.map(row => row.id));
    expect(res.data.count).toBe(3);
  });

  // The cursor the instance is asked for is the one it was given, with nothing in between that
  // could round it.
  test('the instance is asked for the cursor verbatim', async () => {
    const { Gateway, asked } = instanceWith(SAME_SECOND);

    await callAsClient({ lastId: '1790008926.7639065' }, Gateway);

    expect(asked[0]).toBe('1790008926.7639065');
  });
});

describe('what limit counts, and from which end', () => {
  test('it takes the oldest rows after the cursor', async () => {
    const res = await callAsClient({ limit: 1 }, instanceWith(SAME_SECOND).Gateway);

    expect(res.data.logs.map(row => row.id)).toEqual(['1790008519.397928']);
    expect(res.data.count).toBe(1);
  });

  // A page cut short by `limit` must leave the cursor on the last row handed over, or the rows
  // between it and the end of the page are lost.
  test('a page cut short leaves the cursor on the last row delivered', async () => {
    const res = await callAsClient({ limit: 2 }, instanceWith(SAME_SECOND, { pageSize: 50 }).Gateway);

    expect(res.data.lastId).toBe('1790008926.7639065');
  });

  test('without a limit it drains the stream across pages', async () => {
    const { Gateway, asked } = instanceWith(SAME_SECOND, { pageSize: 1 });

    const res = await callAsClient({}, Gateway);

    expect(res.data.logs).toHaveLength(3);
    expect(asked).toEqual(['0', '1790008519.397928', '1790008926.7639065', '1790008926.9111111']);
  });
});

describe('the ends of the stream', () => {
  test('an instance with no rows answers with the cursor it was given', async () => {
    const res = await callAsClient({ lastId: '1790008926.9111111' }, instanceWith([]).Gateway);

    expect(res.data).toMatchObject({ logs: [], count: 0, lastId: '1790008926.9111111' });
  });

  test('omitting lastId starts at the oldest row kept', async () => {
    const { Gateway, asked } = instanceWith(SAME_SECOND);

    await callAsClient({}, Gateway);

    expect(asked[0]).toBe('0');
  });

  /**
   * An instance answering with rows it has already sent — one that ignores `last_id`, or one whose
   * newest row is older than the cursor — would otherwise be paged for ever. The fake gives up
   * after a few tries rather than hanging, so losing the guard fails this in a second instead of
   * stopping the suite on a timeout.
   */
  test('a page that advances nothing ends the call', async () => {
    let calls = 0;
    class Stuck {
      async logs() {
        if (++calls > 3) throw new Error('paged an instance that returned nothing new');
        return { logs: [{ id: '1790008519.397928' }] };
      }
    }

    const res = await callAsClient({ lastId: '1790008926.9111111' }, Stuck);

    expect(res.ok).toBe(true);
    expect(calls).toBe(1);
    expect(res.data.logs).toHaveLength(1);
    expect(res.data.lastId).toBe('1790008926.9111111');
  });
});

/**
 * What each row costs. `limit` goes to 10,000, so a field that carries nothing on every row is paid
 * ten thousand times — measured against a live instance on 2026-09-22, `data` is null and
 * `updated_at` repeats `created_at`, which is 52 bytes of a 322-byte row.
 *
 * Dropped per row and only when empty, rather than by an allowlist: this cannot lose something the
 * instance meant by it, which an allowlist eventually would.
 */
describe('a row carries what the instance actually said', () => {
  const rowsFrom = async (rows) => (await callAsClient({}, instanceWith(rows).Gateway)).data.logs;

  const FULL = {
    id: '1790008519.397928',
    message: 'boom',
    error_type: 'LowLevelError',
    created_at: '2026-09-21T16:35:19.397Z',
    updated_at: '2026-09-21T16:35:19.397Z',
    data: null
  };

  test('an empty data and an updated_at that repeats created_at are not sent on', async () => {
    const [row] = await rowsFrom([FULL]);

    expect(row).toEqual({
      id: FULL.id, message: 'boom', error_type: 'LowLevelError', created_at: FULL.created_at
    });
  });

  test('a row that does carry data keeps it', async () => {
    const [row] = await rowsFrom([{ ...FULL, data: { request_id: 'abc' } }]);

    expect(row.data).toEqual({ request_id: 'abc' });
  });

  test('a row updated after it was written keeps both timestamps', async () => {
    const [row] = await rowsFrom([{ ...FULL, updated_at: '2026-09-21T16:40:00.000Z' }]);

    expect(row.updated_at).toBe('2026-09-21T16:40:00.000Z');
    expect(row.created_at).toBe(FULL.created_at);
  });

  // The measurement the decision rests on, pinned so it cannot quietly stop being true.
  test('the saving is real on a row shaped like the instance sends', async () => {
    const [row] = await rowsFrom([FULL]);

    const before = Buffer.byteLength(JSON.stringify(FULL));
    const after = Buffer.byteLength(JSON.stringify(row));
    expect(before - after).toBeGreaterThanOrEqual(40);
  });

  // Nothing here parses a row, so a shape this did not expect has to travel intact.
  test('a row that is not an object is passed through untouched', async () => {
    class Odd { async logs() { return { logs: ['not-an-object'] } ; } }

    const res = await callAsClient({}, Odd);

    expect(res.data.logs).toEqual(['not-an-object']);
  });
});

/**
 * The questions the description has to answer, because two evaluations lost time to them: one
 * wrote thirteen rows with `{% log %}` and got two unrelated rows from three hours earlier, and
 * neither could tell which end `limit` reads from.
 *
 * Checked per field rather than over the whole blob, so the answer has to be where the reader of
 * that field is: a direction stated only in the tool description does not help someone filling in
 * `limit`. The patterns are deliberately loose — several wordings pass, and dropping the answer
 * does not.
 */
describe('the description answers what an agent cannot find out for itself', () => {
  const property = (name) => tool.inputSchema.properties[name].description;

  test.each([
    ['the tool names the stream it reads', () => tool.description, /error log/i],
    ['the tool says what a liquid-exec render contributes', () => tool.description, /liquid-exec/],
    ['limit says which end it counts from', () => property('limit'), /oldest|newest/i],
    ['lastId says it goes back unchanged', () => property('lastId'), /unchanged|verbatim|as given/i]
  ])('%s', (_label, text, pattern) => {
    expect(text()).toMatch(pattern);
  });

  // Two wrong claims have been made here, so both are pinned: that the log carries no `{% log %}`
  // at all, and that a liquid-exec render never reaches it. A liquid-exec render's Liquid errors do
  // reach it; only its `{% log %}` does not.
  test('it does not deny what a liquid-exec render contributes', () => {
    expect(tool.description).not.toMatch(/does not carry \{% log %\}|never appears here/);
  });
});

// Filtering (TASK-57). `/logs` cannot narrow anything, so the matching is here — and the two
// things that go wrong when it is are a cursor that does not move over the rejected rows, and a
// scan with no end.
//
// Rows copied from the verification instance on 2026-09-22.
const TYPED = [
  { id: '1790097410.8077228', created_at: '2026-09-22T17:16:50.807Z', error_type: 'probe_marker', message: 'probe: boom page reached' },
  { id: '1790097410.8762364', created_at: '2026-09-22T17:16:50.876Z', error_type: 'Liquid error', message: 'Liquid error (views/pages/boom.liquid:4): GraphQL' },
  { id: '1790097411.199142', created_at: '2026-09-22T17:16:51.199Z', error_type: 'probe_marker', message: 'probe: boom page reached' },
  { id: '1790097411.2168736', created_at: '2026-09-22T17:16:51.216Z', error_type: 'Liquid error', message: 'Liquid error (views/pages/boom.liquid:4): GraphQL' },
  { id: '1790097485.2637658', created_at: '2026-09-22T17:18:05.263Z', error_type: 'Liquid error', message: 'Liquid error (line 1): undefined filter upcasess' }
];

/** An instance that never runs out and whose rows are all alike, for the scan bound. */
const endlessNoise = ({ message = 'nothing to see', pageSize = 100 } = {}) => {
  let served = 0;
  class Endless {
    async logs({ lastId }) {
      const start = Math.floor(Number(lastId)) || 1790000000;
      const logs = Array.from({ length: pageSize }, (_, k) => ({ id: `${start + k + 1}.0000001`, error_type: 'noise', message }));
      served += logs.length;
      return { logs };
    }
  }
  return { Gateway: Endless, served: () => served };
};

describe('errorType and contains narrow what comes back', () => {
  const idsOf = (res) => res.data.logs.map(row => row.id);

  test.each([
    ['an exact error_type', { errorType: 'probe_marker' }, ['1790097410.8077228', '1790097411.199142']],
    ['part of one, in another case', { errorType: 'LIQUID' }, ['1790097410.8762364', '1790097411.2168736', '1790097485.2637658']],
    ['part of a message, in another case', { contains: 'UPCASESS' }, ['1790097485.2637658']],
    ['a lower-case needle in a mixed-case message', { contains: 'graphql' }, ['1790097410.8762364', '1790097411.2168736']],
    ['both together, as an and', { errorType: 'liquid', contains: 'boom.liquid' }, ['1790097410.8762364', '1790097411.2168736']],
    ['a filter nothing matches', { contains: 'no such text' }, []]
  ])('%s', async (_label, filter, expected) => {
    const res = await callAsClient(filter, instanceWith(TYPED).Gateway);

    expect(idsOf(res)).toEqual(expected);
    expect(res.data.count).toBe(expected.length);
  });

  // `pos-cli logs --filter error` does not match a row typed `Liquid error`. That trap is why this
  // one is a substring.
  test('a substring matches where the CLI\'s exact filter would not', async () => {
    const res = await callAsClient({ errorType: 'error' }, instanceWith(TYPED).Gateway);

    expect(res.data.count).toBe(3);
    expect(res.data.logs.every(row => row.error_type === 'Liquid error')).toBe(true);
  });

  // `pos-cli logs` renders a message that is not a string, so one can arrive.
  test('a message that is not a string is searched as the text it renders to', async () => {
    const rows = [{ id: '1790097410.8077228', error_type: 'job', message: { error: 'timed out', job: 'import' } }];

    const res = await callAsClient({ contains: 'timed out' }, instanceWith(rows).Gateway);

    expect(res.data.count).toBe(1);
  });

  // The unfiltered call passes one straight through; a filter cannot say anything about it.
  test('a row that is not an object matches no filter', async () => {
    class Odd { async logs({ lastId }) { return { logs: lastId === '0' ? ['not-an-object'] : [] }; } }

    const res = await callAsClient({ contains: 'not' }, Odd);

    expect(res.data.logs).toEqual([]);
  });

  // An empty filter would mean "match everything" here and "match nothing" to whoever wrote it.
  test.each(['errorType', 'contains'])('an empty %s is refused by the published schema', async (name) => {
    const res = await callAsClient({ [name]: '' }, instanceWith(TYPED).Gateway);

    expect(res.rejected).toBeTruthy();
  });

  test('scanned is reported only when a filter was applied', async () => {
    const filtered = await callAsClient({ errorType: 'probe_marker' }, instanceWith(TYPED).Gateway);
    const plain = await callAsClient({}, instanceWith(TYPED).Gateway);

    expect(filtered.data.scanned).toBe(5);
    expect(plain.data).not.toHaveProperty('scanned');
  });
});

// A time converts into a cursor the instance honours, so the skipping happens there and no row is
// fetched to be thrown away.
describe('since starts the read without fetching what it skips', () => {
  test('the instance is asked for the cursor the time converts to', async () => {
    const { Gateway, asked } = instanceWith(TYPED);

    const res = await callAsClient({ since: '2026-09-22T17:16:51.216Z' }, Gateway);

    expect(asked).toEqual(['1790097411.216', '1790097485.2637658']);
    expect(res.data.logs.map(row => row.id)).toEqual(['1790097411.2168736', '1790097485.2637658']);
  });

  // Dividing the milliseconds by 1000 turns `.007` into `.7` — 693 ms later, skipping the rows in
  // between.
  test('milliseconds below 100 keep their leading zeros', async () => {
    const { Gateway, asked } = instanceWith(TYPED);

    await callAsClient({ since: '2026-09-22T17:16:51.007Z' }, Gateway);

    expect(asked[0]).toBe('1790097411.007');
  });

  test('a time on the second boundary is still a full cursor', async () => {
    const { Gateway, asked } = instanceWith(TYPED);

    await callAsClient({ since: '2026-09-22T17:16:51Z' }, Gateway);

    expect(asked[0]).toBe('1790097411.000');
  });

  // Before the epoch there is no id to convert to, and the pattern this tool publishes has no sign.
  test('a time before the epoch reads from the oldest row kept', async () => {
    const { Gateway, asked } = instanceWith(TYPED);

    await callAsClient({ since: '1969-07-20T20:17:00Z' }, Gateway);

    expect(asked[0]).toBe('0');
  });

  test('the cursor it returns is a row id, not the time it was given', async () => {
    const res = await callAsClient({ since: '2026-09-22T17:16:51.216Z' }, instanceWith(TYPED).Gateway);

    expect(res.data.lastId).toBe('1790097485.2637658');
    expect(rejectionFor('logs-fetch', tool, { ...AUTH, lastId: res.data.lastId })).toBeNull();
  });

  // What a model actually types.
  test.each(['yesterday', '2026-09-22 17:16:51', 'now-1h'])('the published schema refuses %s', async (since) => {
    const res = await callAsClient({ since }, instanceWith(TYPED).Gateway);

    expect(res.rejected).toBeTruthy();
  });

  // Reached the way a lib caller would, since `runTool` does not validate. Without the guard the
  // cursor is the string `NaN.NaN`.
  test('a handler called without the gate refuses an unreadable time rather than building a cursor', async () => {
    const { Gateway, asked } = instanceWith(TYPED);

    const res = await runTool(tool, { ...AUTH, since: 'yesterday' }, { Gateway });

    expect(res.ok).toBe(false);
    expect(res.error).toMatchObject({ kind: 'input', code: 'INVALID_SINCE' });
    expect(asked).toEqual([]);
  });
});

// Two starting points, one read: choosing between them silently is the failure.
describe('since and lastId together are refused', () => {
  test('the refusal is an input error, and nothing is asked of the instance', async () => {
    const { Gateway, asked } = instanceWith(TYPED);

    const res = await callAsClient({ since: '2026-09-22T17:16:51.216Z', lastId: '1790097410.8077228' }, Gateway);

    expect(res.rejected).toBeUndefined();
    expect(res.ok).toBe(false);
    expect(res.error).toMatchObject({ kind: 'input', code: 'SINCE_AND_LAST_ID' });
    expect(res.error.message).toMatch(/since|lastId/);
    expect(asked).toEqual([]);
  });

  test('either one alone is fine', async () => {
    const bySince = await callAsClient({ since: '2026-09-22T17:16:51.216Z' }, instanceWith(TYPED).Gateway);
    const byCursor = await callAsClient({ lastId: '1790097411.216' }, instanceWith(TYPED).Gateway);

    expect(bySince.ok).toBe(true);
    expect(byCursor.ok).toBe(true);
    expect(byCursor.data.logs.map(row => row.id)).toEqual(bySince.data.logs.map(row => row.id));
  });
});

// The cursor is the failure that stays invisible until someone resumes.
describe('a filtered read is bounded, and resumable from where it stopped', () => {
  const MIXED = [
    { id: '1790000001.000001', error_type: 'noise', message: 'nothing' },
    { id: '1790000002.000001', error_type: 'noise', message: 'nothing' },
    { id: '1790000003.000001', error_type: 'wanted', message: 'first hit' },
    { id: '1790000004.000001', error_type: 'noise', message: 'nothing' },
    { id: '1790000005.000001', error_type: 'wanted', message: 'second hit' },
    { id: '1790000006.000001', error_type: 'noise', message: 'nothing' }
  ];

  test('limit counts the rows it returns, not the rows it read', async () => {
    const res = await callAsClient({ errorType: 'wanted', limit: 1 }, instanceWith(MIXED).Gateway);

    expect(res.data.count).toBe(1);
    expect(res.data.scanned).toBe(3);
  });

  // The last row does not match, so a cursor moving only over returned rows stops on the second
  // hit and reads the rest again.
  test('the cursor stops on the last row read, not on the last row returned', async () => {
    const res = await callAsClient({ errorType: 'wanted' }, instanceWith(MIXED).Gateway);

    expect(res.data.logs.map(row => row.id)).toEqual(['1790000003.000001', '1790000005.000001']);
    expect(res.data.lastId).toBe('1790000006.000001');
  });

  test('resuming from the cursor reads on from there, with no row read twice', async () => {
    const first = await callAsClient({ errorType: 'wanted', limit: 1 }, instanceWith(MIXED).Gateway);
    expect(first.data.lastId).toBe('1790000003.000001');

    const second = await callAsClient({ errorType: 'wanted', lastId: first.data.lastId }, instanceWith(MIXED).Gateway);

    expect(second.data.logs.map(row => row.id)).toEqual(['1790000005.000001']);
    expect(second.data.scanned).toBe(3);
  });

  // Nothing matched, but six rows were read.
  test('a read that matched nothing still advances past what it read', async () => {
    const res = await callAsClient({ contains: 'no such text' }, instanceWith(MIXED).Gateway);

    expect(res.data).toMatchObject({ count: 0, scanned: 6, lastId: '1790000006.000001' });
    expect(res.data).not.toHaveProperty('scanLimitReached');
  });

  // Without the bound, a filter that matches nothing pages a busy instance for as long as the
  // client waits; this fake hands out rows for ever.
  test('a filter that matches nothing stops at the scan bound and says so', async () => {
    const { Gateway, served } = endlessNoise();

    const res = await callAsClient({ contains: 'needle' }, Gateway);

    expect(res.data).toMatchObject({ count: 0, scanned: MAX_SCAN, scanLimitReached: true });
    expect(MAX_SCAN).toBe(10000);
    expect(served()).toBe(MAX_SCAN);
    expect(res.data.lastId).not.toBe('0');
  }, 30000);

  // Stopping because the caller asked for five rows is not stopping because the scan ran out.
  test('a read that filled its limit does not claim the scan bound', async () => {
    const { Gateway } = endlessNoise({ message: 'needle in here' });

    const res = await callAsClient({ contains: 'needle', limit: 5 }, Gateway);

    expect(res.data).toMatchObject({ count: 5, scanned: 5 });
    expect(res.data).not.toHaveProperty('scanLimitReached');
  });

  // 100 rows a page divides 10,000 exactly, so a page always ends on the bound and the check
  // inside the loop never has to fire. 30 does not divide it, so this one stops mid-page.
  test('the bound stops a scan in the middle of a page', async () => {
    const { Gateway } = endlessNoise({ pageSize: 30 });

    const res = await callAsClient({ contains: 'needle' }, Gateway);

    expect(res.data).toMatchObject({ count: 0, scanned: MAX_SCAN, scanLimitReached: true });
  }, 30000);

  // Both bounds hit at once. The flag says why the read stopped, and here that is the limit.
  test('a limit as large as the scan bound is still the limit that stopped it', async () => {
    const { Gateway } = endlessNoise({ message: 'needle in here' });

    const res = await callAsClient({ contains: 'needle', limit: MAX_SCAN }, Gateway);

    expect(res.data).toMatchObject({ count: MAX_SCAN, scanned: MAX_SCAN });
    expect(res.data).not.toHaveProperty('scanLimitReached');
  }, 30000);
});

/**
 * The guards against a row or a response that is not shaped as expected. Mutation testing found
 * every one of these unexercised: each mutant that removed the guard survived, because no test
 * ever sent the shape it protects against. A filter reaching one of them throws a TypeError, which
 * reaches the caller as INTERNAL_ERROR rather than as "this row does not match".
 */
describe('a filter survives a row that is missing what it filters on', () => {
  const RIGHT = { id: '1790000002.000001', error_type: 'wanted', message: 'hit' };

  test('a row with no error_type does not match, and does not throw', async () => {
    const rows = [{ id: '1790000001.000001', message: 'no type here' }, RIGHT];

    const res = await callAsClient({ errorType: 'wanted' }, instanceWith(rows).Gateway);

    expect(res.ok).toBe(true);
    expect(res.data.logs.map(row => row.id)).toEqual([RIGHT.id]);
  });

  test('a row with no message does not match, and does not throw', async () => {
    const rows = [{ id: '1790000001.000001', error_type: 'wanted' }, RIGHT];

    const res = await callAsClient({ contains: 'hit' }, instanceWith(rows).Gateway);

    expect(res.ok).toBe(true);
    expect(res.data.logs.map(row => row.id)).toEqual([RIGHT.id]);
  });

  // `lean` already treats a null row as possible, so the matcher has to as well.
  test('a null row does not match, and does not throw', async () => {
    class WithNull {
      async logs({ lastId }) { return { logs: lastId === '0' ? [null, RIGHT] : [] }; }
    }

    const res = await callAsClient({ errorType: 'wanted' }, WithNull);

    expect(res.ok).toBe(true);
    expect(res.data.logs).toEqual([RIGHT]);
  });

  test('a response carrying no logs at all ends the call cleanly', async () => {
    class NoLogs { async logs() { return {}; } }

    const res = await callAsClient({}, NoLogs);

    expect(res.ok).toBe(true);
    expect(res.data).toMatchObject({ logs: [], count: 0, lastId: '0' });
  });
});

// The epoch itself: `ms <= 0` and `ms < 0` differ only here.
test('a since of exactly the epoch reads from the oldest row kept', async () => {
  const { Gateway, asked } = instanceWith(TYPED);

  await callAsClient({ since: '1970-01-01T00:00:00.000Z' }, Gateway);

  expect(asked[0]).toBe('0');
});

// An agent that does not know the cost reads a slow call as a hung one.
test('the description says the matching happens here rather than on the instance', () => {
  expect(tool.description).toMatch(/matched here, not by the instance/);
});

/**
 * An empty answer, and which empty it is.
 *
 * `{logs: [], count: 0}` reads the same whether nothing happened in the window asked about or the
 * instance stopped writing to its log days ago. An evaluation hit the second — verified from
 * outside this tool: writes were being discarded while reads still answered, so the newest row was
 * a day older than the session — and could not tell, because the result says nothing about what
 * the instance holds.
 */
describe('an empty read says what the instance actually holds', () => {
  const ROWS = [
    { id: '1790008519.397928', message: 'old', created_at: '2026-09-22T19:15:19.397Z' },
    { id: '1790008926.7639065', message: 'newest', created_at: '2026-09-22T19:22:06.763Z' }
  ];

  test('a since read that found nothing reports the newest row there is', async () => {
    const res = await callAsClient({ since: '2026-09-23T12:00:00Z' }, instanceWith(ROWS).Gateway);

    expect(res.data.count).toBe(0);
    expect(res.data.newestRow).toEqual({ id: '1790008926.7639065', created_at: '2026-09-22T19:22:06.763Z' });
  });

  test('a log holding nothing at all answers null, which is a different thing', async () => {
    const res = await callAsClient({ since: '2026-09-23T12:00:00Z' }, instanceWith([]).Gateway);

    expect(res.data.newestRow).toBeNull();
  });

  test('a read that found rows does not ask, and does not say', async () => {
    const { Gateway, asked } = instanceWith(ROWS);

    const res = await callAsClient({ since: '2026-01-01T00:00:00Z' }, Gateway);

    expect(res.data.count).toBe(2);
    expect(Object.hasOwn(res.data, 'newestRow')).toBe(false);
    expect(asked).not.toContain('0');
  });

  /**
   * The cost gate. A tail polls with `lastId` at the tip of the stream and comes back empty most
   * times it is called; charging that an extra request would put the cost on the common path to
   * answer a question it did not ask.
   */
  test('an empty lastId poll asks nothing extra', async () => {
    const { Gateway, asked } = instanceWith(ROWS);

    const res = await callAsClient({ lastId: '9999999999.9' }, Gateway);

    expect(res.data.count).toBe(0);
    expect(Object.hasOwn(res.data, 'newestRow')).toBe(false);
    expect(asked).toEqual(['9999999999.9']);
  });

  test('an instance that will not answer the extra question still returns the rows it did', async () => {
    class HalfBroken {
      async logs({ lastId }) {
        if (lastId === '0') throw Object.assign(new Error('nope'), { statusCode: 503 });
        return { logs: [] };
      }
    }

    const res = await callAsClient({ since: '2026-09-23T12:00:00Z' }, HalfBroken);

    expect(res.ok).toBe(true);
    expect(Object.hasOwn(res.data, 'newestRow')).toBe(false);
  });
});
