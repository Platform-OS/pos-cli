import { describe, test, expect } from 'vitest';

import {
  permits, isInsufficientScopeRefusal, requiredScopesOf, isTwoFactorNotEnabled, isInstanceNotCovered, isTokenRefusal,
  tokenRefusalMessage
} from '#lib/utils/tokenScopes.js';

// The same rule the Partner Portal and the Instance apply; a difference here would only
// make the GUI hide or offer the wrong things, but it should not be one.
describe('permits', () => {
  test('`*` covers everything, including scopes added later', () => {
    expect(permits(['*'], 'code:write')).toBe(true);
    expect(permits(['*'], 'something:new')).toBe(true);
  });

  test('`*:read` covers every read and no write', () => {
    expect(permits(['*:read'], 'records:read')).toBe(true);
    expect(permits(['*:read'], 'future:read')).toBe(true);
    expect(permits(['*:read'], 'records:write')).toBe(false);
    expect(permits(['*:read'], 'data:clean')).toBe(false);
  });

  test('anything else matches exactly', () => {
    expect(permits(['records:write'], 'records:write')).toBe(true);
    expect(permits(['records:write'], 'records:read')).toBe(false);
    expect(permits(['records:*'], 'records:read')).toBe(false);
  });

  test('no scopes at all is full access, an empty list is none', () => {
    expect(permits(null, 'liquid:exec')).toBe(true);
    expect(permits(undefined, 'liquid:exec')).toBe(true);
    expect(permits([], 'logs:read')).toBe(false);
  });
});

describe('an insufficient-scope refusal', () => {
  const refusal = (body, statusCode = 403) => ({ statusCode, response: { body } });

  test('is a 403 naming insufficient_scope', () => {
    expect(isInsufficientScopeRefusal(refusal({ error: 'insufficient_scope' }))).toBe(true);
    expect(isInsufficientScopeRefusal(refusal({ error: 'insufficient_scope' }, 401))).toBe(false);
    expect(isInsufficientScopeRefusal(refusal({ error: 'forbidden' }))).toBe(false);
    expect(isInsufficientScopeRefusal(refusal('<html>'))).toBe(false);
  });

  test('reads the scopes it names', () => {
    expect(requiredScopesOf(refusal({ required_scopes: ['records:write', 'users:write'] }))).toEqual(['records:write', 'users:write']);
    expect(requiredScopesOf(refusal({}))).toEqual([]);
  });
});

describe('the Partner Portal refusals of a global token', () => {
  const refusal = (error, statusCode = 403) => ({ statusCode, response: { body: { error, errors: ['x'] } } });

  // two_factor_not_enabled is a two-factor refusal, which the Portal answers 401.
  test('are recognised by their code and status', () => {
    expect(isTwoFactorNotEnabled(refusal('two_factor_not_enabled', 401))).toBe(true);
    expect(isTwoFactorNotEnabled(refusal('two_factor_not_enabled'))).toBe(true);
    expect(isTwoFactorNotEnabled(refusal('two_factor_not_enabled', 500))).toBe(false);
    expect(isInstanceNotCovered(refusal('instance_not_covered', 401))).toBe(false);
    expect(isInstanceNotCovered(refusal('instance_not_covered'))).toBe(true);
    expect(isInstanceNotCovered(refusal('insufficient_scope'))).toBe(false);
    expect(isTokenRefusal(refusal('instance_not_covered'))).toBe(true);
    expect(isTokenRefusal(refusal('forbidden'))).toBe(false);
  });

  test('say what to do, and never suggest refresh-token', () => {
    const notEnabled = tokenRefusalMessage(refusal('two_factor_not_enabled'));
    expect(notEnabled).toContain('two-factor authentication is not enabled on its account');
    expect(notEnabled).toContain('create a new token');

    expect(tokenRefusalMessage(refusal('instance_not_covered'), { instance: 'https://shop.example.com' }))
      .toContain('does not reach https://shop.example.com, or its owner cannot change it');
    expect(tokenRefusalMessage(refusal('instance_not_covered'))).toContain('does not reach this instance');

    for (const code of ['two_factor_not_enabled', 'instance_not_covered']) {
      expect(tokenRefusalMessage(refusal(code))).not.toContain('refresh-token');
    }
    expect(tokenRefusalMessage(refusal('forbidden'))).toBeNull();
  });
});
