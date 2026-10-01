/**
 * `TestLogStream.fetchLogs` — which row has been handled, and what cursor goes back.
 *
 * Both used to be answered by `row.id <= this.lastId`. A row id is a microsecond epoch sent as a
 * string with a fraction whose length varies, so after the first row that compare is lexicographic:
 * wrong wherever one fraction is a prefix of another, and — since it was also the cursor — it moved
 * backwards on a page that arrived out of order.
 */
import { describe, test, expect } from 'vitest';
import { TestLogStream } from '#lib/test-runner/logStream.js';

/** A stream that answers from `pages`, records the cursor it was asked with, and collects rows. */
const streamOver = (pages) => {
  const asked = [];
  const handled = [];
  const stream = new TestLogStream({});

  stream.gateway = { logs: async ({ lastId }) => { asked.push(lastId); return { logs: pages.shift() ?? [] }; } };
  stream.abortController = new AbortController();
  stream.processLogMessage = (row) => handled.push(row);

  return { stream, asked, handled };
};

const poll = async (stream, times) => {
  for (let i = 0; i < times; i++) await stream.fetchLogs();
};

describe('a row is handled once', () => {
  // Some instances treat `last_id` as inclusive and repeat the cursor row on the next page.
  test('a page that repeats the cursor row does not replay it', async () => {
    const { stream, handled } = streamOver([
      [{ id: '1790008926.76', message: 'a' }, { id: '1790008926.99', message: 'b' }],
      [{ id: '1790008926.99', message: 'b' }, { id: '1790008927.10', message: 'c' }]
    ]);

    await poll(stream, 2);

    expect(handled.map(r => r.message)).toEqual(['a', 'b', 'c']);
  });

  test('a page of nothing but rows already handled emits nothing and holds the cursor', async () => {
    const { stream, asked, handled } = streamOver([
      [{ id: '1790008926.99', message: 'a' }],
      [{ id: '1790008926.99', message: 'a' }]
    ]);

    await poll(stream, 3);

    expect(handled.map(r => r.message)).toEqual(['a']);
    expect(asked).toEqual(['0', '1790008926.99', '1790008926.99']);
  });
});

describe('a row is not dropped because of how its id sorts', () => {
  /**
   * The defect. Ordering decided both questions, so the shorter fraction — which is the *newer*
   * instant, and sorts first as a string — was read as already handled and skipped. Reordering is
   * the situation the guard existed for, and the one it got wrong.
   */
  test('a page out of order keeps every row, and the cursor is the newest of them', async () => {
    const { stream, asked, handled } = streamOver([
      [{ id: '1790008926.7639065', message: 'later' }, { id: '1790008926.76', message: 'earlier' }],
      []
    ]);

    await poll(stream, 2);

    expect(handled.map(r => r.message)).toEqual(['later', 'earlier']);
    // Not the last row iterated, which is how `bin/pos-cli-logs.js` picks one: that would hand the
    // instance a cursor behind rows already handled, for ever.
    expect(asked[1]).toBe('1790008926.7639065');
  });

  // The same instant written two ways. A string compare puts the padded one second, so whichever
  // arrived first used to hide the other.
  test('a fraction padded with zeros does not hide the row it matches', async () => {
    const { stream, handled } = streamOver([
      [{ id: '1790008926.7600000', message: 'padded' }, { id: '1790008926.76', message: 'short' }]
    ]);

    await poll(stream, 1);

    expect(handled.map(r => r.message)).toEqual(['padded', 'short']);
  });
});

describe('the cursor is a string the instance gets back unchanged', () => {
  test('the first poll starts at the beginning', async () => {
    const { stream, asked } = streamOver([[]]);

    await poll(stream, 1);

    expect(asked).toEqual(['0']);
  });

  // These differ in the 17th significant digit, which a double cannot hold: parsed, the cursor
  // would go back rounded and re-deliver rows the run has already printed.
  test('ids a double cannot separate go back exactly as they arrived', async () => {
    expect(Number('1790097411.2168736')).toBe(Number('1790097411.2168737'));
    const { stream, asked, handled } = streamOver([
      [{ id: '1790097411.2168736', message: 'a' }, { id: '1790097411.2168737', message: 'b' }],
      []
    ]);

    await poll(stream, 2);

    expect(handled.map(r => r.message)).toEqual(['a', 'b']);
    expect(asked[1]).toBe('1790097411.2168737');
  });
});
