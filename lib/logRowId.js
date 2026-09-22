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
