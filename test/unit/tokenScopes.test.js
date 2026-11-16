import { describe, test, expect } from 'vitest';

import {
  permits, isInsufficientScopeRefusal, requiredScopesOf, isTwoFactorNotEnabled, isInstanceNotCovered, isTokenRefusal,
  tokenRefusalMessage
} from '#lib/utils/tokenScopes.js';

// The same rule the Partner Portal (AccessTokens::Scopes.permits?) and the Instance
// (TokenScopes.permits?) apply; a difference here would only make the GUI hide or offer the
// wrong things, but it should not be one.
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

  test('`*:read` does not cover the reads that hand over a secret', () => {
    expect(permits(['*:read'], 'constants:read')).toBe(false);
    expect(permits(['*:read'], 'data_import:read')).toBe(false);
    expect(permits(['*:read', 'constants:read'], 'constants:read')).toBe(true);
  });

  test('a write means read + write: it covers the read of the same subject, secret reads included', () => {
    expect(permits(['records:write'], 'records:write')).toBe(true);
    expect(permits(['users:write'], 'users:read')).toBe(true);
    expect(permits(['instance:manage'], 'instance:read')).toBe(true);
    expect(permits(['notifications:send'], 'notifications:read')).toBe(true);
    expect(permits(['constants:write'], 'constants:read')).toBe(true);
    expect(permits(['data_import:write'], 'data_import:read')).toBe(true);
  });

  test('a scope covers nothing about another subject, and a read never covers a write', () => {
    expect(permits(['users:write'], 'records:read')).toBe(false);
    expect(permits(['users:read'], 'users:write')).toBe(false);
    expect(permits(['records:*'], 'records:write')).toBe(false);
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

  test('names the instance the caller knows, not the host the request went to', () => {
    const error = { ...refusal({ error: 'insufficient_scope', required_scopes: ['code:write'] }),
      options: { uri: 'https://deploy.example.com/presign-url' } };

    expect(tokenRefusalMessage(error, { instance: 'https://shop.example.com' }))
      .toContain('This token does not have the code:write scope needed for this on shop.example.com.');
    expect(tokenRefusalMessage(error)).toContain('needed for this on deploy.example.com.');
  });

  test('does not send the operator after a scope when none would help', () => {
    const error = { ...refusal({ error: 'insufficient_scope', required_scopes: [], errors: [{ message: 'Closed to scoped tokens' }] }),
      options: { uri: 'https://shop.example.com/api/private/api_keys' } };

    expect(tokenRefusalMessage(error)).toBe(
      "This token's scopes do not allow this on shop.example.com.\n" +
      'Closed to scoped tokens\n' +
      'No scope covers it: use a token that is not limited to scopes (an Administrator token, or one from `pos-cli env add`).\n' +
      'This is not something `pos-cli env refresh-token` can fix — the token is valid, it is just limited.'
    );
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
