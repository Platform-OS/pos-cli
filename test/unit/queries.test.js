/**
 * Unit tests for lib/graph/queries.js
 * Verifies queries produce valid GraphQL strings.
 */
import { describe, test, expect } from 'vitest';
import { getConstants, setConstant, unsetConstant } from '../../lib/graph/queries.js';

describe('graph/queries', () => {
  test('getConstants returns a query for all constants', () => {
    const query = getConstants();
    expect(query).toContain('query getConstants');
    expect(query).toContain('constants(per_page: 99)');
    expect(query).toContain('results { name, value, updated_at }');
  });

  test('setConstant builds a mutation with interpolated name and value', () => {
    expect(setConstant('API_KEY', 'secret123')).toContain('constant_set(name: "API_KEY", value: "secret123")');
  });

  test('unsetConstant builds a mutation with interpolated name', () => {
    expect(unsetConstant('API_KEY')).toContain('constant_unset(name: "API_KEY")');
  });
});
