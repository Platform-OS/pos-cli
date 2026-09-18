/**
 * DNS-rebinding and cross-site protection for the HTTP transport. Loopback keeps other machines
 * out but not a web page in the user's own browser, which can resolve its domain to 127.0.0.1 or
 * post there directly; such requests carry the attacker's hostname in Host or Origin. Not
 * authentication — a non-browser client sends whatever headers it likes.
 *
 * Mirrors @modelcontextprotocol/express 2.0.0 (hostHeaderValidation + originValidation) message
 * for message, so adopting the SDK's middleware later is invisible to clients. Keep them in step.
 */
import log from './log.js';

// Only the hostname is compared; the port is ignored, as in the SDK.
export function checkHost(hostHeader, allowedHostnames) {
  if (!hostHeader) return { ok: false, message: 'Missing Host header' };

  let hostname;
  try {
    hostname = new URL(`http://${hostHeader}`).hostname;
  } catch {
    return { ok: false, message: `Invalid Host header: ${hostHeader}` };
  }
  if (!allowedHostnames.includes(hostname)) return { ok: false, message: `Invalid Host: ${hostname}` };
  return { ok: true };
}

// Non-browser clients send no Origin, so its absence passes. A present value that does not
// parse to a hostname — including the literal "null" of sandboxed frames and file:// pages —
// is rejected.
export function checkOrigin(originHeader, allowedHostnames) {
  if (originHeader === undefined || originHeader === null || originHeader === '') return { ok: true };

  let hostname;
  try {
    hostname = new URL(originHeader).hostname;
  } catch {
    return { ok: false, message: `Invalid Origin header: ${originHeader}` };
  }
  if (hostname === '') return { ok: false, message: `Invalid Origin header: ${originHeader}` };
  if (!allowedHostnames.includes(hostname)) return { ok: false, message: `Invalid Origin: ${hostname}` };
  return { ok: true };
}

/**
 * @param {readonly string[]} allowedHostnames - as URL#hostname reports them (lowercase, IPv6 in
 *   brackets); see LOOPBACK_HOSTNAMES in http-config.js
 */
export default function hostValidation(allowedHostnames) {
  // A string would turn every check into a substring match ("localhost,10.0.0.5" includes "host").
  if (!Array.isArray(allowedHostnames)) {
    throw new TypeError('hostValidation: allowedHostnames must be an array of hostnames');
  }
  const allowed = Object.freeze([...allowedHostnames]);

  return (req, res, next) => {
    const host = checkHost(req.headers.host, allowed);
    const result = host.ok ? checkOrigin(req.headers.origin, allowed) : host;
    if (result.ok) return next();

    log.warn('HTTP request rejected', { method: req.method, url: req.originalUrl || req.url, reason: result.message });
    res.status(403).json({ jsonrpc: '2.0', error: { code: -32000, message: result.message }, id: null });
  };
}
