import { afterEach, describe, expect, test } from 'vitest';
import { timeRange, localDay } from '../../gui/next/src/lib/api/timeRange.js';

// The admin GUI's Logs v2 and Network pages search the instance by `_timestamp`, which is in
// microseconds. The range used to send its end in microseconds and its start in milliseconds, so
// every search started in January 1970; and it read the chosen day as UTC midnight before moving
// to the local end of day, which lands on the day before anywhere west of UTC.

const originalTz = process.env.TZ;
const inZone = (zone) => { process.env.TZ = zone; };
const microseconds = (isoInstant) => new Date(isoInstant).getTime() * 1000;
const day = 24 * 60 * 60 * 1000 * 1000;

afterEach(() => {
  process.env.TZ = originalTz;
});

describe('timeRange', () => {
  test.each([
    ['Europe/Warsaw', '2026-07-15T23:59:59.999+02:00'],
    ['America/New_York', '2026-07-15T23:59:59.999-04:00'],
    ['Asia/Tokyo', '2026-07-15T23:59:59.999+09:00'],
    ['UTC', '2026-07-15T23:59:59.999Z']
  ])('ends at the last microsecond of the chosen day in %s', (zone, endOfDay) => {
    inZone(zone);

    expect(timeRange('2026-07-15').end_time).toBe(microseconds(endOfDay) + 999);
  });

  test.each(['Europe/Warsaw', 'America/New_York', 'Asia/Tokyo'])('starts three days before its end, in microseconds, in %s', (zone) => {
    inZone(zone);

    const { start_time, end_time } = timeRange('2026-07-15');

    expect(end_time - start_time).toBe(3 * day);
  });

  test('keeps three calendar days across a daylight saving change', () => {
    inZone('Europe/Warsaw');

    // clocks went back an hour on 2026-10-25, so these three days are 73 hours long
    const { start_time, end_time } = timeRange('2026-10-27');

    expect(start_time).toBe(microseconds('2026-10-24T23:59:59.999+02:00') + 999);
    expect(end_time).toBe(microseconds('2026-10-27T23:59:59.999+01:00') + 999);
  });

  test.each([undefined, '', 'yesterday', '2026-7-15', '2026-13-45', '2026-07-15T00:00', '0'])('searches without a limit for %j', (value) => {
    expect(timeRange(value)).toEqual({ start_time: 0, end_time: 0 });
  });
});

describe('localDay', () => {
  test('names the day in the local time zone, not in UTC', () => {
    inZone('Europe/Warsaw');

    // 00:30 on the 30th in Warsaw is still the 29th in UTC
    expect(localDay(new Date('2026-10-29T23:30:00Z'))).toBe('2026-10-30');
  });

  test('names the day west of UTC', () => {
    inZone('America/New_York');

    // 20:00 on the 29th in New York is already the 30th in UTC
    expect(localDay(new Date('2026-10-30T00:00:00Z'))).toBe('2026-10-29');
  });

  test('pads the month and the day', () => {
    inZone('UTC');

    expect(localDay(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });
});
