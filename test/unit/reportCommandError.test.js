import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn(), Success: vi.fn() }
}));
vi.mock('#lib/logger/report.js', () => ({ default: vi.fn() }));

import { reportCommandError } from '#lib/reportCommandError.js';
import logger from '#lib/logger.js';

const refusal = (error) => Object.assign(new Error('Request failed with status 403'), {
  name: 'StatusCodeError',
  statusCode: 403,
  options: { uri: 'https://partners.platformos.com/api/tasks/instance/create' },
  response: { statusCode: 403, body: { error, errors: ['from the portal'] } }
});

// A command that ends over one of the Partner Portal's refusals of a global token prints what
// to do, not "Request failed with status 403".
describe('reportCommandError', () => {
  beforeEach(() => vi.clearAllMocks());

  test.each([
    ['two_factor_not_enabled', 'two-factor authentication is not enabled on its account'],
    ['instance_not_covered', 'does not reach this instance, or its owner cannot change it'],
    // no required_scopes: closed to scoped tokens, so no scope to go and add
    ['insufficient_scope', 'No scope covers it: use a token that is not limited to scopes']
  ])('explains %s', async (code, expected) => {
    await reportCommandError(refusal(code), { prefix: 'Deploy failed' });

    const [message, options] = logger.Error.mock.calls[0];
    expect(message).toContain(expected);
    expect(message).not.toContain('Request failed with status 403');
    expect(options).toEqual(expect.objectContaining({ hideTimestamp: true, exit: true }));
  });

  test('names the missing scope and where to get it', async () => {
    const error = refusal('insufficient_scope');
    error.response.body.required_scopes = ['code:write'];
    await reportCommandError(error, { prefix: 'Deploy failed' });

    const [message] = logger.Error.mock.calls[0];
    expect(message).toContain('This token does not have the code:write scope needed for this on partners.platformos.com.');
    expect(message).toContain('Create a token with it on the Partner Portal Tokens page.');
  });

  test('leaves any other 403 to the generic report', async () => {
    await reportCommandError(refusal('forbidden'), { prefix: 'Deploy failed' });

    const printed = logger.Error.mock.calls.map(([message]) => String(message)).join('\n');
    expect(printed).not.toContain('Partner Portal Tokens page');
    expect(printed).not.toContain('two-factor authentication is not enabled');
  });
});
