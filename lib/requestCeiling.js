/**
 * The ceiling Node's HTTP client puts on a request, and the one case where it is wrong.
 *
 * `fetch` applies undici's `headersTimeout` -- 300s by default -- to the whole request *send*, and
 * it does not reset as bytes move. Measured 2026-09-24 (Node 25.6.0, built-in undici 7.19.2): a
 * 96MB body going out at a steady 256KB/s, never stalling, was killed at 300.9s with 64MB already
 * delivered; the same upload answered 200 at 384.8s with the ceiling raised. So an upload needing
 * more than five minutes cannot succeed, and it fails as `fetch failed`, which names neither the
 * host nor the cause. A 50MB archive needs 1.4 Mbit/s sustained to fit inside 300s.
 *
 * An `AbortSignal` cannot fix this: a signal only ever ends a request *earlier* than the ceiling.
 * Raising the ceiling needs a dispatcher, which is why `undici` is a direct dependency.
 */

/**
 * The backstop for a transfer, and deliberately above every deadline pos-cli sets itself (the
 * longest is `lib/portal.js`, 30s), so that a deadline we chose is what reports a timeout and this
 * is what catches a transfer nobody bounded. Finite, never `0`: `0` disables the timeout outright,
 * and a socket that dies mid-upload would then hold a deploy for ever.
 */
export const UPLOAD_HEADERS_TIMEOUT_MS = 20 * 60 * 1000;

// A body that is already bytes -- a file on its way to object storage -- is sent as it is.
// Only a plain object is JSON-encoded, which is what every other caller passes; a Buffer
// down that path would arrive as {"type":"Buffer","data":[...]}.
export const isRawBody = (value) =>
  Buffer.isBuffer(value) || value instanceof Uint8Array || value instanceof ArrayBuffer;

/**
 * Whether this request sends a file. It has to keep matching `apiRequest`'s body-building: a
 * `FormData` the caller built (a presigned S3 POST), raw bytes (a presigned PUT), and the two
 * values `buildFormData` turns into a file part. Wrong in either direction and a request gets the
 * ceiling meant for the other kind -- an upload cut off at five minutes, or an ordinary call left
 * waiting twenty.
 */
export const carriesAFile = ({ formData, body } = {}) => {
  if (formData instanceof FormData) return true;
  if (isRawBody(body)) return true;

  return !!formData && Object.values(formData)
    .some(value => Buffer.isBuffer(value) || (value && typeof value === 'object' && value.path));
};

/**
 * One Agent for the process, built the first time a file is sent -- or nothing at all, when
 * something else is already steering how this process reaches the network.
 *
 * **A dispatcher replaces the one the process would otherwise use, routing included.** Node 24
 * installs an `EnvHttpProxyAgent` globally when `NODE_USE_ENV_PROXY` is set (measured: the global
 * dispatcher is `Agent` without it and `EnvHttpProxyAgent` with it), and a plain Agent of ours
 * would ignore that -- so on a corporate network every pos-cli request would go through the proxy
 * except an upload, which would try to connect directly and be refused. Raising a ceiling must not
 * change where the bytes go, so when the global dispatcher is anything but a stock Agent this
 * returns nothing and the upload runs exactly as every other request does, at the default ceiling.
 * Building an `EnvHttpProxyAgent` of our own with the longer timeout would fix those uploads too,
 * but undici marks that class experimental and warns on every construction; it is the follow-up if
 * somebody needs it, not something to ship on a guess.
 *
 * An Agent owns a connection pool, so one per request would leave a pool per upload behind in the
 * long-lived MCP server. Measured: a shared one pools per origin, so the same instance serves S3,
 * the Partner Portal and the platformOS instance, and it does not hold the event loop open once
 * the work is done -- a CLI command still exits immediately.
 *
 * Imported here rather than at the top of the file because `apiRequest` is on the path of every
 * command, and loading undici costs ~125ms measured -- which `pos-cli env list` would pay for a
 * library only an upload uses. The *promise* is what is memoised, so two uploads starting together
 * share one Agent instead of racing to build two and leaking the loser's pool.
 *
 * `bodyTimeout` is left at undici's default on purpose. It bounds reading the *response*, which on
 * every one of these endpoints is a few bytes of JSON or XML; raising it would loosen a bound that
 * is not the one that is wrong.
 *
 * A failed import is deliberately not caught. undici is a declared dependency, so it missing is a
 * broken install rather than a condition to design for -- and falling back would put uploads
 * silently back under the five-minute cap, which is the failure this whole module exists to stop
 * happening quietly.
 */
let dispatcher;
export const uploadDispatcher = () => (dispatcher ??= import('undici').then(({ Agent, getGlobalDispatcher }) => {
  // By name, not `instanceof`: the global one is built by Node's own copy of undici, which is a
  // different class object from the one imported here (7.19.2 against 6.28.1 as measured).
  const steeredElsewhere = getGlobalDispatcher()?.constructor?.name !== 'Agent';

  return steeredElsewhere ? undefined : new Agent({ headersTimeout: UPLOAD_HEADERS_TIMEOUT_MS });
}));

const CEILING_CODES = new Set(['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);

/**
 * Whether a failed request ran out of time rather than failing to connect. undici reports its own
 * ceiling as a cause some way down a chain whose depth varies by Node version, the same reason
 * `getNetworkErrorCode` (`lib/ServerError.js`) walks rather than indexes.
 */
export const hitTheCeiling = (error, depth = 0) => {
  if (!error || depth > 5) return false;
  if (CEILING_CODES.has(error.code)) return true;

  return hitTheCeiling(error.cause, depth + 1);
};
