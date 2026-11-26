import { describe, test, expect } from 'vitest';
import { maskSecret, redactSecrets } from '#lib/utils/maskSecret.js';

const GLOBAL_TOKEN = 'posg_abcdefghijklmnopqrstuvwxyz0123456789WXYZ';

describe('maskSecret', () => {
  test('keeps the first six and the last four characters', () => {
    expect(maskSecret(GLOBAL_TOKEN)).toBe('posg_a…WXYZ');
  });

  test('hides a short value entirely, giving only its length', () => {
    expect(maskSecret('short-secret')).toBe('[12 chars]');
  });

  test('says what was missing', () => {
    expect(maskSecret(undefined)).toBe('undefined');
    expect(maskSecret(null)).toBe('null');
  });
});

describe('redactSecrets', () => {
  test('masks credentials at any depth and leaves everything else alone', () => {
    const pos = {
      staging: {
        url: 'https://example.com',
        token: GLOBAL_TOKEN,
        email: 'me@example.com',
        two_factor_session: { token: GLOBAL_TOKEN, expires_at: '2026-11-26T12:00:00Z' },
        bound_tokens: { 'example.com': { token: GLOBAL_TOKEN, expires_at: 1 } }
      },
      shared: { url: 'https://other.example.com', portal: 'ps01' }
    };

    const redacted = redactSecrets(pos);

    expect(JSON.stringify(redacted)).not.toContain(GLOBAL_TOKEN);
    expect(redacted.staging.token).toBe('posg_a…WXYZ');
    expect(redacted.staging.two_factor_session).toEqual({ token: 'posg_a…WXYZ', expires_at: '2026-11-26T12:00:00Z' });
    expect(redacted.staging.bound_tokens['example.com'].token).toBe('posg_a…WXYZ');
    expect(redacted.staging.email).toBe('me@example.com');
    expect(redacted.shared).toEqual(pos.shared);
  });

  test('masks the fields of an OAuth token response', () => {
    const response = { access_token: GLOBAL_TOKEN, refresh_token: GLOBAL_TOKEN, device_code: GLOBAL_TOKEN, token_type: 'Bearer' };

    expect(redactSecrets(response)).toEqual({
      access_token: 'posg_a…WXYZ',
      refresh_token: 'posg_a…WXYZ',
      device_code: 'posg_a…WXYZ',
      token_type: 'Bearer'
    });
  });

  test('does not change its argument', () => {
    const response = { access_token: GLOBAL_TOKEN };
    redactSecrets(response);

    expect(response.access_token).toBe(GLOBAL_TOKEN);
  });

  test('passes through what is not a plain object', () => {
    expect(redactSecrets('text')).toBe('text');
    expect(redactSecrets(undefined)).toBeUndefined();
    expect(redactSecrets([{ token: GLOBAL_TOKEN }])).toEqual([{ token: 'posg_a…WXYZ' }]);
  });
});
