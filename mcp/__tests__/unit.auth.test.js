const Auth = require('../auth');

describe('Auth middleware', () => {
  test('middleware allows with correct key', () => {
    const auth = new Auth();
    const mw = auth.middleware();
    const req = { get: () => 'testkey', query: {} };
    const res = { status: () => ({ json: () => {} }) };
    let called = false;
    mw(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  test('middleware denies without key', () => {
    const auth = new Auth();
    const mw = auth.middleware();
    const req = { get: () => null, query: {} };
    const res = { status: jest.fn(() => ({ json: jest.fn() })) };
    mw(req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
