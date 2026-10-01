/**
 * readHttpConfig decides where the unauthenticated HTTP transport listens and which
 * Host/Origin hostnames it answers. Wrong defaults expose every tool; a malformed value that
 * is silently ignored or silently never matches looks like protection that is not there.
 */
import { describe, test, expect } from 'vitest';
import { readHttpConfig, HttpConfigError, LOOPBACK_HOSTNAMES } from '../http-config.js';
import { checkHost, checkOrigin } from '../host-validation.js';

const configError = (fn) => {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected readHttpConfig to throw');
};

describe('defaults', () => {
  test('an empty environment listens on 127.0.0.1:5910 and answers loopback names only', () => {
    expect(readHttpConfig({})).toEqual({
      host: '127.0.0.1',
      port: 5910,
      allowedHostnames: ['localhost', '127.0.0.1', '[::1]'],
      exposed: false
    });
  });

  test('empty and whitespace-only values count as unset', () => {
    expect(readHttpConfig({ MCP_MIN_HOST: '', MCP_MIN_PORT: '  ', MCP_MIN_ALLOWED_HOSTS: '' }))
      .toEqual(readHttpConfig({}));
  });

  test('the loopback allowlist cannot be mutated by a caller', () => {
    const { allowedHostnames } = readHttpConfig({});
    expect(Object.isFrozen(allowedHostnames)).toBe(true);
    expect(Object.isFrozen(LOOPBACK_HOSTNAMES)).toBe(true);
  });
});

describe('MCP_MIN_HOST', () => {
  test.each([
    ['127.0.0.1', '127.0.0.1'],
    ['127.0.0.2', '127.0.0.2'],
    ['::1', '::1'],
    ['0:0:0:0:0:0:0:1', '0:0:0:0:0:0:0:1'],
    ['::ffff:127.0.0.1', '::ffff:127.0.0.1'],
    ['localhost', 'localhost'],
    ['LocalHost', 'localhost'],
    [' 127.0.0.1 ', '127.0.0.1']
  ])('%j is a loopback bind, not exposed', (value, host) => {
    expect(readHttpConfig({ MCP_MIN_HOST: value })).toMatchObject({ host, exposed: false });
  });

  test.each(['0.0.0.0', '::', '192.168.1.5', '10.0.0.1', 'fe80::1', '::ffff:192.168.1.5'])(
    '%j is exposed beyond this machine',
    (value) => {
      expect(readHttpConfig({ MCP_MIN_HOST: value })).toMatchObject({ host: value, exposed: true });
    }
  );

  test.each([
    'not a host',
    'example.com',
    'devbox.local',
    '127.0.0.1:5910',
    'http://127.0.0.1',
    '0.0.0.0/0',
    '999.0.0.1',
    '*'
  ])('%j is rejected naming the variable and the value', (value) => {
    const err = configError(() => readHttpConfig({ MCP_MIN_HOST: value }));
    expect(err).toBeInstanceOf(HttpConfigError);
    expect(err.name).toBe('HttpConfigError');
    expect(err.message).toContain('MCP_MIN_HOST');
    expect(err.message).toContain(`"${value}"`);
  });

  test('a bracketed IPv6 address is rejected with a hint to drop the brackets', () => {
    const err = configError(() => readHttpConfig({ MCP_MIN_HOST: '[::1]' }));
    expect(err).toBeInstanceOf(HttpConfigError);
    expect(err.message).toContain('without brackets');
  });
});

describe('MCP_MIN_PORT', () => {
  test.each([['0', 0], ['5910', 5910], ['65535', 65535], [' 8080 ', 8080]])('%j is port %i', (value, port) => {
    expect(readHttpConfig({ MCP_MIN_PORT: value }).port).toBe(port);
  });

  // A non-numeric string would reach server.listen() as a named pipe path.
  test.each(['abc', '-1', '65536', '99999', '5910.5', '1e3', '0x10', '/tmp/mcp.sock', '5910abc'])(
    '%j is rejected',
    (value) => {
      const err = configError(() => readHttpConfig({ MCP_MIN_PORT: value }));
      expect(err).toBeInstanceOf(HttpConfigError);
      expect(err.message).toContain('MCP_MIN_PORT');
      expect(err.message).toContain(`"${value}"`);
    }
  );
});

describe('MCP_MIN_ALLOWED_HOSTS', () => {
  test('entries are appended to the loopback names, normalized the way request headers are', () => {
    const { allowedHostnames } = readHttpConfig({
      MCP_MIN_ALLOWED_HOSTS: 'DevBox.Local, 10.0.0.5 ,[0:0:0:0:0:0:0:2],bücher.example,localhost'
    });
    expect(allowedHostnames).toEqual([
      'localhost', '127.0.0.1', '[::1]',
      'devbox.local', '10.0.0.5', '[::2]', 'xn--bcher-kva.example'
    ]);
  });

  test('entries never replace the loopback names', () => {
    expect(readHttpConfig({ MCP_MIN_ALLOWED_HOSTS: 'devbox.local' }).allowedHostnames)
      .toEqual(expect.arrayContaining([...LOOPBACK_HOSTNAMES]));
  });

  // What makes an entry worth accepting is that a real request can match it. Checked
  // against the same function the middleware uses, with the header a client would send.
  test.each([
    ['devbox.local', 'devbox.local:5910', 'http://devbox.local:3000'],
    ['DevBox.Local', 'DEVBOX.local', 'https://devbox.local'],
    ['10.0.0.5', '10.0.0.5:5910', 'http://10.0.0.5'],
    ['[::2]', '[::2]:5910', 'http://[::2]:8080'],
    ['bücher.example', 'xn--bcher-kva.example:5910', 'http://xn--bcher-kva.example'],
    ['host.docker.internal', 'host.docker.internal', 'http://host.docker.internal:5910']
  ])('accepted entry %j matches Host %j and Origin %j', (entry, hostHeader, originHeader) => {
    const { allowedHostnames } = readHttpConfig({ MCP_MIN_ALLOWED_HOSTS: entry });
    expect(checkHost(hostHeader, allowedHostnames)).toEqual({ ok: true });
    expect(checkOrigin(originHeader, allowedHostnames)).toEqual({ ok: true });
    expect(checkHost(hostHeader, LOOPBACK_HOSTNAMES).ok).toBe(false);
  });

  test.each([
    ['http://devbox.local', 'without a scheme'],
    ['devbox.local:5910', 'port'],
    ['devbox.local:80', 'port'],          // URL parsing drops a default port, so this is checked on the raw entry
    ['[::1]:5910', 'port'],
    ['::1', 'in brackets'],
    ['fe80::1', 'in brackets'],
    ['*.example.com', 'wildcards'],
    ['devbox.local/mcp', 'hostname only'],
    ['user@devbox.local', 'hostname only'],
    ['dev box', 'hostname only'],
    ['[not-an-ip]', 'IPv6'],
    ['999.1.1.1', 'not a valid hostname']
  ])('%j is rejected (%s)', (value, reason) => {
    const err = configError(() => readHttpConfig({ MCP_MIN_ALLOWED_HOSTS: value }));
    expect(err).toBeInstanceOf(HttpConfigError);
    expect(err.message).toContain('MCP_MIN_ALLOWED_HOSTS');
    expect(err.message).toContain(`"${value}"`);
    expect(err.message).toContain(reason);
  });

  test.each(['a,,b', 'a,', ',a', ',', 'a, ,b'])('%j is rejected for its empty entry', (value) => {
    const err = configError(() => readHttpConfig({ MCP_MIN_ALLOWED_HOSTS: value }));
    expect(err).toBeInstanceOf(HttpConfigError);
    expect(err.message).toContain('MCP_MIN_ALLOWED_HOSTS');
    expect(err.message).toContain(`"${value}"`);
    expect(err.message).toContain('empty entry');
  });

  test('one bad entry rejects the whole list rather than dropping just that entry', () => {
    expect(() => readHttpConfig({ MCP_MIN_ALLOWED_HOSTS: 'devbox.local,devbox.local:5910' })).toThrow(HttpConfigError);
  });
});
