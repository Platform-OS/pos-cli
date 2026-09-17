/**
 * Where the HTTP transport listens and which Host/Origin hostnames it answers, read from
 * the environment once at startup.
 *
 * The HTTP transport has no authentication: whoever can reach it runs every enabled tool
 * with the credentials this process resolves (.pos, MPKIT_*). So the defaults are the safe
 * ones — bind loopback only, answer loopback names only — and anything wider is an explicit
 * opt-in. Malformed values fail closed: a typo in MCP_MIN_HOST must not fall back to some
 * other bind address, and an allowlist entry that could never match a request (a URL, a
 * host:port) must not look like it took effect.
 */
import net from 'net';

// Not 'localhost': it can resolve to ::1 alone, and every client that dials 127.0.0.1
// would then be refused.
export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 5910;

// Hostnames as the WHATWG URL parser reports them (IPv6 in brackets), which is the form
// host-validation.js compares against. Always allowed, whatever the bind address.
export const LOOPBACK_HOSTNAMES = Object.freeze(['localhost', '127.0.0.1', '[::1]']);

export class HttpConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HttpConfigError';
  }
}

const LOOPBACK_ADDRESSES = new net.BlockList();
LOOPBACK_ADDRESSES.addSubnet('127.0.0.0', 8, 'ipv4');
LOOPBACK_ADDRESSES.addAddress('::1', 'ipv6');

// Any spelling of a loopback address counts: 127.0.0.0/8, ::1 in any form, and IPv4-mapped
// loopback (::ffff:127.0.0.1), which BlockList matches against the IPv4 subnet.
function isLoopbackBindHost(host) {
  if (host === 'localhost') return true;
  const family = net.isIP(host);
  return LOOPBACK_ADDRESSES.check(host, family === 6 ? 'ipv6' : 'ipv4');
}

// Unset and empty both mean "not configured", matching how MCP_MIN_PORT has always been
// read (`process.env.MCP_MIN_PORT || 5910`).
function envValue(env, name) {
  const raw = env[name];
  if (raw === undefined) return undefined;
  const trimmed = String(raw).trim();
  return trimmed === '' ? undefined : trimmed;
}

function readHost(env) {
  const value = envValue(env, 'MCP_MIN_HOST');
  if (value === undefined) return DEFAULT_HOST;
  if (value.toLowerCase() === 'localhost') return 'localhost';
  if (net.isIP(value) !== 0) return value;

  const hint = /^\[.*\]$/.test(value) ? ' (write IPv6 addresses without brackets, e.g. ::1)' : '';
  throw new HttpConfigError(
    `Invalid MCP_MIN_HOST "${value}": expected an IP address such as 127.0.0.1, 0.0.0.0 or ::1, or "localhost"${hint}.`
  );
}

// A value that is not a decimal port would otherwise reach server.listen(), which treats
// a non-numeric string as a named pipe path and creates a socket file in the cwd.
function readPort(env) {
  const value = envValue(env, 'MCP_MIN_PORT');
  if (value === undefined) return DEFAULT_PORT;
  if (/^\d{1,5}$/.test(value) && Number(value) <= 65535) return Number(value);

  throw new HttpConfigError(`Invalid MCP_MIN_PORT "${value}": expected a port number from 0 to 65535.`);
}

function allowedHostError(entry, reason) {
  return new HttpConfigError(`Invalid MCP_MIN_ALLOWED_HOSTS entry "${entry}": ${reason}.`);
}

// Returns the hostname in the exact form a request's Host/Origin header is reduced to, so
// an accepted entry is one that can actually match.
function normalizeAllowedHost(entry, list) {
  if (entry === '') {
    throw new HttpConfigError(
      `Invalid MCP_MIN_ALLOWED_HOSTS "${list}": empty entry. Separate hostnames with single commas.`
    );
  }
  if (entry.includes('://')) throw allowedHostError(entry, 'list the hostname only, without a scheme');
  if (/[/?#@\\\s]/.test(entry)) throw allowedHostError(entry, 'expected a hostname only, without path, credentials or spaces');

  const bracketed = /^\[([^\]]*)\](.*)$/.exec(entry);
  if (bracketed) {
    if (bracketed[2] !== '') throw allowedHostError(entry, 'the port is not part of the match; list the hostname only');
    if (!net.isIPv6(bracketed[1])) throw allowedHostError(entry, 'not a valid IPv6 address');
  } else if (entry.includes(':')) {
    // "::1:5910" is itself a valid IPv6 address, so an unbracketed one cannot be told apart
    // from host:port; brackets are required instead of guessing.
    if (net.isIPv6(entry)) throw allowedHostError(entry, `write IPv6 addresses in brackets, e.g. [${entry}]`);
    throw allowedHostError(entry, 'the port is not part of the match; list the hostname only');
  }

  let hostname;
  try {
    hostname = new URL(`http://${entry}`).hostname;
  } catch {
    throw allowedHostError(entry, 'not a valid hostname or IP address');
  }
  // Wildcards and other characters the URL parser tolerates would be stored literally and
  // never equal a real Host header.
  if (!bracketed && !/^[a-z0-9._-]+$/.test(hostname)) {
    throw allowedHostError(entry, 'not a valid hostname (wildcards are not supported)');
  }
  return hostname;
}

function readAllowedHostnames(env) {
  const value = envValue(env, 'MCP_MIN_ALLOWED_HOSTS');
  const extra = value === undefined ? [] : value.split(',').map(entry => normalizeAllowedHost(entry.trim(), value));
  return Object.freeze([...new Set([...LOOPBACK_HOSTNAMES, ...extra])]);
}

/**
 * @param {Record<string, string | undefined>} env - usually process.env
 * @returns {{ host: string, port: number, allowedHostnames: readonly string[], exposed: boolean }}
 *   `exposed` is true when the bind address is not loopback, i.e. other machines may reach it.
 * @throws {HttpConfigError} when MCP_MIN_HOST, MCP_MIN_PORT or MCP_MIN_ALLOWED_HOSTS is malformed
 */
export function readHttpConfig(env) {
  const host = readHost(env);
  return {
    host,
    port: readPort(env),
    allowedHostnames: readAllowedHostnames(env),
    exposed: !isLoopbackBindHost(host)
  };
}
