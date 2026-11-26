/**
 * Credentials as they may appear in a debug log: enough of the value to tell two of them
 * apart (and a global token by its `posg_` prefix), never enough to use one. The logger does
 * no redaction of its own, and DEBUG=1 output is exactly what people paste into bug reports.
 */
const KEEP_START = 6;
const KEEP_END = 4;
// Below this, the kept ends would be most of the value.
const MIN_LENGTH = 20;

const SECRET_KEYS = new Set(['access_token', 'refresh_token', 'id_token', 'token', 'device_code', 'delivery_token']);

const maskSecret = (value) => {
  if (value === null || value === undefined) return String(value);

  const text = String(value);
  if (text.length < MIN_LENGTH) return `[${text.length} chars]`;

  return `${text.slice(0, KEEP_START)}…${text.slice(-KEEP_END)}`;
};

/**
 * A copy of a parsed response with every credential field masked, at any depth, for logging.
 * Anything that is not a plain object or array comes back as it is.
 */
const redactSecrets = (data) => {
  if (Array.isArray(data)) return data.map(redactSecrets);
  if (data === null || typeof data !== 'object' || Object.getPrototypeOf(data) !== Object.prototype) return data;

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      SECRET_KEYS.has(key) && (typeof value === 'string' || typeof value === 'number') ? maskSecret(value) : redactSecrets(value)
    ])
  );
};

export { maskSecret, redactSecrets };
