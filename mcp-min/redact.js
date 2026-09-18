/**
 * What the log is allowed to say about a value. `log.js` runs everything through this, so a leak
 * needs a new kind of secret rather than just a new logging line.
 *
 * A secret is replaced entirely; a token is masked to `abc...xyz`, enough to tell which credential
 * was used without being usable. Imports nothing: `log.js` is below everything else in the server.
 */

// Matched anywhere in the name: the next credential arrives as `X-Auth-Token`, `portalApiKey` or
// `password_hint`. The cost is the occasional innocent field, which is the cheaper mistake.
const SECRET_WORDS = ['authorization', 'password', 'passwd', 'secret', 'privatekey', 'apikey', 'cookie', 'credentials'];
const MASKED_WORDS = ['token', 'jwt', 'bearer', 'session'];

// Secrets rather than the tokens or sessions their names contain; `code` is not worth matching as
// a word, since `statusCode` is not a secret.
const SECRET_KEYS = new Set(['refreshtoken', 'usertemporarytoken', 'twofactorsession', 'devicecode', 'usercode']);

// `x-api-key`, `X_API_KEY` and `apiKey` are one name as far as this is concerned.
const normalise = key => key.toLowerCase().replace(/[^a-z0-9]/g, '');

const mentions = (key, words) => words.some(word => key.includes(word));

// A credential travels inside strings too: `Authorization: Token abc…` arrives as one, and device
// flows put codes in query strings. Twelve characters and a digit distinguish one from the next
// English word ("exchange failed").
const SCHEME_CREDENTIAL = /\b(bearer|basic|token)\s+(?=[A-Za-z0-9\-._~+/]*[0-9])([A-Za-z0-9\-._~+/]{12,}={0,2})/gi;
const QUERY_CREDENTIAL = /([?&](?:access_token|refresh_token|token|password|secret|api_key|apikey|client_secret|device_code|user_code|code)=)([^&#\s"'\\]+)/gi;
// https://user:password@host — the password half of a URL nobody meant to publish.
const URL_USERINFO = /(\w+:\/\/[^/\s:@]+):([^/\s@]+)@/g;

export const REDACTED = '[redacted]';

// The log is append-only and shared by every session on the machine, and a `data-import` payload
// can be megabytes. Long values are kept, but bounded.
export const MAX_STRING_LENGTH = 4096;
export const MAX_ARRAY_LENGTH = 100;
export const MAX_ENTRIES = 100;
export const MAX_DEPTH = 8;

/** `abc...xyz`. Short values are dropped instead: three of eight characters is most of the secret. */
export function mask(value) {
  const text = String(value);
  return text.length < 12 ? REDACTED : `${text.slice(0, 3)}...${text.slice(-3)}`;
}

/** Credentials that travelled inside a string: an Authorization value, a URL with a code in it. */
export function scrubString(text) {
  const scrubbed = text
    .replace(SCHEME_CREDENTIAL, (_match, scheme) => `${scheme} ${REDACTED}`)
    .replace(QUERY_CREDENTIAL, (_match, prefix) => `${prefix}${REDACTED}`)
    .replace(URL_USERINFO, (_match, before) => `${before}:${REDACTED}@`);

  return scrubbed.length > MAX_STRING_LENGTH
    ? `${scrubbed.slice(0, MAX_STRING_LENGTH)}… (${scrubbed.length - MAX_STRING_LENGTH} more characters)`
    : scrubbed;
}

function redactValue(value, keyName, depth, seen) {
  // `tokenProvided: true`: a boolean under a credential name is the fact that there was one,
  // which is the whole reason such a field is logged instead of the value.
  if (keyName !== undefined && typeof value !== 'boolean') {
    const key = normalise(keyName);
    if (SECRET_KEYS.has(key) || mentions(key, SECRET_WORDS)) return REDACTED;
    // An empty or absent token says something real ("none was sent"); mask only what is there.
    if (mentions(key, MASKED_WORDS) && value !== null && value !== undefined && value !== '') {
      return typeof value === 'object' ? REDACTED : mask(value);
    }
  }

  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'bigint') return `${value}`; // JSON.stringify throws on these
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`;
  if (value === null || typeof value !== 'object') return value;

  // An Error serialises to `{}` through JSON, and a fetch failure keeps its code two or three
  // `cause` levels down (CLAUDE.md), so the chain is followed rather than flattened.
  if (value instanceof Error) {
    return {
      error: scrubString(`${value.name}: ${value.message}`),
      ...(value.code !== undefined && { code: value.code }),
      ...(value.statusCode !== undefined && { statusCode: value.statusCode }),
      ...(value.cause !== undefined && { cause: redactValue(value.cause, undefined, depth + 1, seen) })
    };
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) return `[Map(${value.size})]`;
  if (value instanceof Set) return `[Set(${value.size})]`;
  // Binary is an object of numeric keys to JSON: a 10 MB upload would become a log line per byte.
  // A Buffer is a Uint8Array, so `isView` covers it.
  if (ArrayBuffer.isView(value)) return `[${value.constructor?.name ?? 'TypedArray'}(${value.byteLength} bytes)]`;
  if (value instanceof ArrayBuffer) return `[ArrayBuffer(${value.byteLength} bytes)]`;

  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[deep]';
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const kept = value.slice(0, MAX_ARRAY_LENGTH).map(item => redactValue(item, undefined, depth + 1, seen));
      return value.length > MAX_ARRAY_LENGTH
        ? [...kept, `… (${value.length - MAX_ARRAY_LENGTH} more items)`]
        : kept;
    }

    const out = {};
    let kept = 0;
    for (const [key, item] of Object.entries(value)) {
      if (kept === MAX_ENTRIES) {
        out['…'] = `(${Object.keys(value).length - MAX_ENTRIES} more keys)`;
        break;
      }
      const redacted = redactValue(item, key, depth + 1, seen);
      if (redacted === undefined) continue;
      kept += 1;
      // `__proto__` from JSON.parse is an ordinary key; assigning it would set a prototype and
      // drop the field from the line instead of showing it.
      if (key === '__proto__') Object.defineProperty(out, key, { value: redacted, enumerable: true, writable: true, configurable: true });
      else out[key] = redacted;
    }
    return out;
  } finally {
    // Siblings may legitimately share an object; only a value inside itself is circular.
    seen.delete(value);
  }
}

/** The value as the log may write it: safe to print and safe for `JSON.stringify`. */
export function redact(data) {
  if (data === undefined) return undefined;
  return redactValue(data, undefined, 0, new Set());
}

export default redact;
