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
import tool from '../logs/fetch.js';

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
 * The questions the description has to answer, because an evaluation lost time to both: it wrote
 * thirteen rows with `{% log %}` and got two unrelated rows from three hours earlier, and it had no
 * way to know which end `limit` reads from.
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
    ['the tool says {% log %} output is not in it', () => tool.description, /\{% log %\}/],
    ['limit says which end it counts from', () => property('limit'), /oldest|newest/i],
    ['lastId says it goes back unchanged', () => property('lastId'), /unchanged|verbatim|as given/i]
  ])('%s', (_label, text, pattern) => {
    expect(text()).toMatch(pattern);
  });
});
