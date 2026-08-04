/**
 * Unit tests for lib/graph/response.js
 * A failed GraphQL request still resolves with HTTP 200 and reports its errors
 * in the body, so every surface shares these helpers to detect that.
 */
import { describe, test, expect } from 'vitest';
import { graphQLErrors, formatGraphQLErrors, graphQLErrorMessage } from '../../lib/graph/response.js';

describe('graph/response', () => {
  describe('graphQLErrors', () => {
    test('returns the raw errors array, preserving locations and extensions', () => {
      const errors = [{ message: 'Bad input', locations: [{ line: 2, column: 5 }], extensions: { code: 'ARG' } }];
      expect(graphQLErrors({ errors, data: null })).toBe(errors);
    });

    test('returns null when the response carries no errors', () => {
      expect(graphQLErrors({ data: { ok: true } })).toBeNull();
    });

    test('treats an empty errors array as no errors', () => {
      expect(graphQLErrors({ errors: [], data: { ok: true } })).toBeNull();
    });

    test('tolerates null, undefined and a non-array errors field', () => {
      expect(graphQLErrors(null)).toBeNull();
      expect(graphQLErrors(undefined)).toBeNull();
      expect(graphQLErrors({ errors: 'boom' })).toBeNull();
    });
  });

  describe('formatGraphQLErrors', () => {
    test('joins every message, not just the first', () => {
      const errors = [{ message: 'first' }, { message: 'second' }, { message: 'third' }];
      expect(formatGraphQLErrors(errors)).toBe('first, second, third');
    });

    test('returns an empty string for an empty or missing array', () => {
      expect(formatGraphQLErrors([])).toBe('');
      expect(formatGraphQLErrors(null)).toBe('');
    });
  });

  describe('graphQLErrorMessage', () => {
    test('returns one joined message when the response failed', () => {
      expect(graphQLErrorMessage({ errors: [{ message: 'Unauthorized' }] })).toBe('Unauthorized');
      expect(graphQLErrorMessage({ errors: [{ message: 'a' }, { message: 'b' }] })).toBe('a, b');
    });

    test('returns null for a successful response', () => {
      expect(graphQLErrorMessage({ data: { constants: { results: [] } } })).toBeNull();
      expect(graphQLErrorMessage({ errors: [] })).toBeNull();
    });
  });
});
