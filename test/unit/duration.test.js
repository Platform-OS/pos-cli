/**
 * Unit tests for duration utility
 * Tests time formatting as MM:SS
 */
import { describe, test, expect } from 'vitest';
import duration from '#lib/duration.js';

describe('duration', () => {
  describe('formatMMSS', () => {
    test('formats 0 seconds as 0:00', () => {
      const t0 = Date.now();
      const t1 = t0; // 0 seconds

      expect(duration(t0, t1)).toBe('0:00');
    });

    test('formats 1 second correctly', () => {
      const t0 = Date.now();
      const t1 = t0 + 1000; // 1 second

      expect(duration(t0, t1)).toBe('0:01');
    });

    test('formats 9 seconds correctly', () => {
      const t0 = Date.now();
      const t1 = t0 + 9000; // 9 seconds

      expect(duration(t0, t1)).toBe('0:09');
    });

    test('formats 10 seconds correctly', () => {
      const t0 = Date.now();
      const t1 = t0 + 10000; // 10 seconds

      expect(duration(t0, t1)).toBe('0:10');
    });

    test('formats 59 seconds correctly', () => {
      const t0 = Date.now();
      const t1 = t0 + 59000; // 59 seconds

      expect(duration(t0, t1)).toBe('0:59');
    });

    test('formats 60 seconds as 1:00', () => {
      const t0 = Date.now();
      const t1 = t0 + 60000; // 60 seconds

      expect(duration(t0, t1)).toBe('1:00');
    });

    test('formats 61 seconds as 1:01', () => {
      const t0 = Date.now();
      const t1 = t0 + 61000; // 61 seconds

      expect(duration(t0, t1)).toBe('1:01');
    });

    test('formats 90 seconds as 1:30', () => {
      const t0 = Date.now();
      const t1 = t0 + 90000; // 90 seconds

      expect(duration(t0, t1)).toBe('1:30');
    });

    test('formats 120 seconds as 2:00', () => {
      const t0 = Date.now();
      const t1 = t0 + 120000; // 120 seconds

      expect(duration(t0, t1)).toBe('2:00');
    });

    test('formats 5 minutes correctly', () => {
      const t0 = Date.now();
      const t1 = t0 + 300000; // 5 minutes

      expect(duration(t0, t1)).toBe('5:00');
    });

    test('formats 10 minutes correctly', () => {
      const t0 = Date.now();
      const t1 = t0 + 600000; // 10 minutes

      expect(duration(t0, t1)).toBe('10:00');
    });

    test('formats 10 minutes 5 seconds correctly', () => {
      const t0 = Date.now();
      const t1 = t0 + 605000; // 10 minutes 5 seconds

      expect(duration(t0, t1)).toBe('10:05');
    });

    test('rounds down sub-second times', () => {
      const t0 = Date.now();
      const t1 = t0 + 1499; // 1.499 seconds

      expect(duration(t0, t1)).toBe('0:01');
    });

    test('rounds up at 500ms', () => {
      const t0 = Date.now();
      const t1 = t0 + 1500; // 1.5 seconds

      expect(duration(t0, t1)).toBe('0:02');
    });

    test('handles large durations', () => {
      const t0 = Date.now();
      const t1 = t0 + 3600000; // 60 minutes (1 hour)

      expect(duration(t0, t1)).toBe('60:00');
    });

    test('handles very large durations', () => {
      const t0 = Date.now();
      const t1 = t0 + 5400000; // 90 minutes

      expect(duration(t0, t1)).toBe('90:00');
    });
  });
});
