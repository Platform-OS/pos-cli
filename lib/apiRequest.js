import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const buildFormData = (formData) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(formData)) {
    if (value && typeof value === 'object' && value.path) {
      const fileBuffer = fs.readFileSync(value.path);
      const filename = path.basename(value.path);
      form.append(key, new Blob([fileBuffer]), filename);
    } else if (Buffer.isBuffer(value)) {
      form.append(key, new Blob([value]));
    } else if (value !== undefined && value !== null) {
      form.append(key, String(value));
    }
  }
  return form;
};

/**
 * How long a request may go **unanswered**. Not a whole-response deadline: `AbortSignal.timeout`
 * would abort a transfer that is making progress, which is the one thing a large upload does.
 * The clock stops the moment response headers arrive, so reading a slow body is never cut off.
 *
 * This is a backstop, not a latency target. Nothing measured comes close to it — a full 39-test
 * suite answers in 2.4s — and it exists so that an instance which accepts a connection and then
 * says nothing ends the call instead of holding a socket and a promise for the life of the
 * process.
 *
 * **The number is chosen to sit under the HTTP client's own cap**, which is what makes it the
 * bound that actually fires. `fetch` gives every request 300s (undici's `headersTimeout`, measured
 * 2026-09-24), counted over the whole send and never reset as bytes move, and reaching it produces
 * `fetch failed` — which `ServerError` cannot place, so it prints "Request to the server failed."
 * with no host, no duration and no sign that it was a timeout. A bound above 300s could never be
 * reached and would be a promise the runtime breaks; this one wins, and reports itself properly.
 * A caller that knows its endpoint passes a shorter `timeout`: the Partner Portal answers JSON in
 * milliseconds, so waiting minutes on it reaches an operator as a command that stopped.
 */
export const RESPONSE_TIMEOUT_MS = 4.5 * 60 * 1000;

// A body that is already bytes -- a file on its way to object storage -- is sent as it is.
// Only a plain object is JSON-encoded, which is what every other caller passes; a Buffer
// down that path would arrive as {"type":"Buffer","data":[...]}.
const isRawBody = (value) =>
  Buffer.isBuffer(value) || value instanceof Uint8Array || value instanceof ArrayBuffer;

/**
 * The deadline for one request: a signal to hand `fetch`, and a way to ask afterwards whether it
 * was this that ended the call rather than the caller cancelling.
 *
 * Built on setTimeout rather than AbortSignal.timeout so that it composes with a signal the caller
 * already has, and stays visible to anything that controls the clock.
 */
export const responseDeadline = ({ signal, timeout = RESPONSE_TIMEOUT_MS }) => {
  const deadline = new AbortController();
  let expired = false;
  const timer = setTimeout(() => { expired = true; deadline.abort(); }, timeout);
  // A deadline is a limit on waiting, never a reason to keep waiting.
  timer.unref?.();

  return {
    // The caller's signal still cancels; this only adds a second way for the wait to end.
    signal: signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal,
    reached: () => expired,
    clear: () => clearTimeout(timer)
  };
};

/**
 * Shaped like every other network failure rather than surfacing as a bare AbortError: `ServerError`
 * reads `.name` and walks the cause chain to `.code`, and `classify` reads `code` too — ETIMEDOUT
 * is already in its unreachable set, so a timeout arrives as `unavailable` with the host named,
 * the same as a refused connection.
 */
export const timedOut = (uri, timeout, cause) => Object.assign(
  new Error(`No response in ${Math.round(timeout / 1000)}s`),
  { name: 'RequestError', code: 'ETIMEDOUT', cause, options: { uri } }
);

const sendRequest = async (uri, fetchOptions, json, deadline, timeout) => {
  let response;
  try {
    response = await fetch(uri, fetchOptions);
  } catch (e) {
    // An abort reports where it was interrupted, not why. Only this frame knows the request ran
    // out of time rather than being cancelled by the caller.
    if (deadline.reached()) throw timedOut(uri, timeout, e);
    const error = new Error(e.message);
    error.name = 'RequestError';
    error.cause = e;
    error.options = { uri };
    throw error;
  } finally {
    // Headers are in: the body may take as long as it takes.
    deadline.clear();
  }

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(`Request failed with status ${response.status}`);
    error.name = 'StatusCodeError';
    error.statusCode = response.status;
    error.options = { uri };
    error.response = {
      statusCode: response.status,
      body: errorBody,
      headers: Object.fromEntries(response.headers.entries())
    };
    try {
      error.response.body = JSON.parse(errorBody);
    } catch {
      // JSON parse failed, keep original body
    }
    throw error;
  }

  if (json) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return response.text();
};

const apiRequest = async ({ method = 'GET', uri, body, headers = {}, formData, json = true, forever, signal, timeout }) => {
  logger.Debug(`[${method}] ${uri}`);

  const fetchOptions = {
    method,
    headers: { ...headers }
  };

  if (formData) {
    // An S3 POST policy arrives as a FormData the caller has already built: its field
    // order and the uploaded file's name are part of what was signed, so it is sent
    // untouched rather than rebuilt from a plain object.
    fetchOptions.body = formData instanceof FormData ? formData : buildFormData(formData);
  } else if (isRawBody(body)) {
    // Content-Type belongs to the caller here -- only they know what the bytes are.
    fetchOptions.body = body;
  } else if (body) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  } else if (json && typeof json === 'object' && !['GET', 'HEAD'].includes(method.toUpperCase())) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(json);
  }

  if (forever) {
    fetchOptions.keepalive = true;
  }

  const waitMs = timeout ?? RESPONSE_TIMEOUT_MS;
  const deadline = responseDeadline({ signal, timeout: waitMs });
  fetchOptions.signal = deadline.signal;

  return sendRequest(uri, fetchOptions, json, deadline, waitMs);
};

export { apiRequest };
