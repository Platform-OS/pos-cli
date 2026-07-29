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

  test('setConstant builds a mutation using variables, not interpolation', () => {
    const { query, variables } = setConstant('API_KEY', 'secret123');
    expect(query).toContain('constant_set(name: $name, value: $value)');
    expect(query).not.toContain('secret123');
    expect(variables).toEqual({ name: 'API_KEY', value: 'secret123' });
  });

  test('setConstant passes multiline values through variables untouched', () => {
    const multilineValue = '-----BEGIN KEY-----\nline one\nline two\n-----END KEY-----';
    const { query, variables } = setConstant('PEM_KEY', multilineValue);
    expect(query).not.toContain('line one');
    expect(variables.value).toBe(multilineValue);
  });

  test('unsetConstant builds a mutation using variables, not interpolation', () => {
    const { query, variables } = unsetConstant('API_KEY');
    expect(query).toContain('constant_unset(name: $name)');
    expect(variables).toEqual({ name: 'API_KEY' });
  });
});
