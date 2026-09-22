// Ordering log row ids, which neither `Number` nor `<` gets right. Both mistakes have shipped.
import { describe, test, expect } from 'vitest';
import { isNewer, newerOf } from '#lib/logRowId.js';

describe('the two comparisons that look right and are not', () => {
  // The 17th significant digit is past what a double holds, so these parse to one value.
  test('ids a double cannot separate are separated', () => {
    expect(Number('1790097411.2168736')).toBe(Number('1790097411.2168737'));

    expect(isNewer('1790097411.2168737', '1790097411.2168736')).toBe(true);
    expect(isNewer('1790097411.2168736', '1790097411.2168737')).toBe(false);
  });

  // Where a string compare goes wrong: one fraction is a prefix of the other, so the shorter sorts
  // first although both name the same instant.
  test('a fraction padded with zeros is the same instant, not a newer one', () => {
    expect('1790008926.76' < '1790008926.7600000').toBe(true);

    expect(isNewer('1790008926.7600000', '1790008926.76')).toBe(false);
    expect(isNewer('1790008926.76', '1790008926.7600000')).toBe(false);
  });

  // Digit position decides, which is what makes the padding above safe.
  test('a longer fraction is not automatically newer', () => {
    expect(isNewer('1790008926.7639065', '1790008926.76')).toBe(true);
    expect(isNewer('1790008926.76', '1790008926.7639065')).toBe(false);
  });
});

describe('ordinary ordering', () => {
  test.each([
    ['a later second', '1790097412.1', '1790097411.9', true],
    ['an earlier second', '1790097411.9', '1790097412.1', false],
    ['equal ids', '1790097411.216', '1790097411.216', false],
    ['a fraction against none', '1790097411.001', '1790097411', true],
    ['none against a fraction', '1790097411', '1790097411.001', false],
    ['more whole digits', '17900974110.0', '1790097411.0', true],
    // The case string comparison gets wrong: the larger number has the smaller leading digit.
    ['a wider number with a smaller first digit', '10000000000.0', '9999999999.0', true],
    ['and the reverse', '9999999999.0', '10000000000.0', false],
    ['the zero seed', '1790097411.216', '0', true]
  ])('%s', (_label, id, cursor, expected) => {
    expect(isNewer(id, cursor)).toBe(expected);
  });

  // Fraction digits line up by position, so a longer fraction is not automatically larger.
  test('fractions are compared by position, not by length', () => {
    expect(isNewer('1790097411.2', '1790097411.19999999')).toBe(true);
  });
});

// Rows arrive from the network. Nothing here may throw on one that is not an id, and nothing that
// is not an id may be mistaken for a newer row and become the cursor.
describe('anything that is not a row id is never newer', () => {
  test.each([
    ['undefined', undefined],
    ['null', null],
    ['a non-numeric string', 'not-an-id'],
    ['a negative number', '-1790097411.2'],
    ['scientific notation', '1.79e9'],
    ['a cursor with query parameters', '1790097411.2&limit=1']
  ])('%s', (_label, value) => {
    expect(isNewer(value, '1790097411.216')).toBe(false);
    expect(newerOf('1790097411.216', value)).toBe('1790097411.216');
  });

  test('an unreadable cursor is not overtaken either', () => {
    expect(isNewer('1790097411.216', 'not-an-id')).toBe(false);
  });
});

describe('newerOf advances a cursor without parsing it', () => {
  test('it returns the newer of the two, as a string', () => {
    expect(newerOf('1790097411.216', '1790097411.999')).toBe('1790097411.999');
    expect(newerOf('1790097411.999', '1790097411.216')).toBe('1790097411.999');
  });

  test('the digits it returns are the ones it was given', () => {
    // Number('1790097411.2168736') would come back as 1790097411.2168736 rounded and re-printed.
    expect(newerOf('0', '1790097411.2168736')).toBe('1790097411.2168736');
  });
});
