/**
 * The log row id: what it looks like, and the only correct way to order two of them.
 *
 * An id is a microsecond epoch the instance sends as a string — `"1790008926.7639065"` — with a
 * fraction whose length varies. `Number()` rounds at the 17th significant digit, so two adjacent
 * ids collapse to one value; a plain string compare puts `.76` before `.7600000`, which is the
 * same instant. Both mistakes have shipped.
 */

/** The pattern, as a JSON Schema string. Every schema that publishes a cursor uses this one. */
export const ROW_ID = '^[0-9]+(\\.[0-9]+)?$';

/**
 * The two cursors `last_id` reads as special, and the difference is the platform's.
 *
 * Measured 2026-09-25 against an instance holding 35 rows over three days: `0` is read as *no
 * cursor at all* and answers with the newest page — 20 rows — while `1`, `0.001` and `0.000001`
 * are each the strict greater-than above and returned all 35. Only the exact value `0` is special.
 * `1` is 1970-01-01T00:00:01Z, older than any row that can exist.
 */
export const NEWEST_PAGE = '0';
export const OLDEST_RETAINED = '1';

/**
 * A millisecond instant as a cursor the instance itself skips by: a row id is a microsecond epoch
 * of the same moment `created_at` names. Built from integer milliseconds, because dividing rounds.
 *
 * Shared so that the two readers cannot encode it differently — `logs-fetch` converts a caller's
 * `since`, and `tests/crash-check.js` converts the instant a run was sent.
 */
export const cursorForMs = (ms) => {
  // At or before the epoch the caller is asking for everything, which is the one thing `0` does
  // not mean here.
  if (!Number.isFinite(ms) || ms <= 0) return OLDEST_RETAINED;

  const seconds = Math.floor(ms / 1000);
  return `${seconds}.${String(ms - seconds * 1000).padStart(3, '0')}`;
};

const IS_ROW_ID = new RegExp(ROW_ID);

// The schema above accepts leading zeros, so `007` must not out-rank `7` on width alone.
const significant = (digits) => digits.replace(/^0+(?=[0-9])/, '');

/** Whether `id` is strictly newer than `cursor`. A value that is not a row id is never newer. */
export const isNewer = (id, cursor) => {
  const left = String(id);
  const right = String(cursor);
  if (!IS_ROW_ID.test(left) || !IS_ROW_ID.test(right)) return false;

  const [leftWhole, leftFraction = ''] = left.split('.');
  const [rightWhole, rightFraction = ''] = right.split('.');
  const a = significant(leftWhole);
  const b = significant(rightWhole);
  if (a.length !== b.length) return a.length > b.length;
  if (a !== b) return a > b;

  const width = Math.max(leftFraction.length, rightFraction.length);
  return leftFraction.padEnd(width, '0') > rightFraction.padEnd(width, '0');
};

/** The newer of the two, as a string, for advancing a cursor without ever parsing it. */
export const newerOf = (cursor, id) => (isNewer(id, cursor) ? String(id) : String(cursor));
