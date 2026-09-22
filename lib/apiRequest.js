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
 * A request deadline, as a signal.
 *
 * undici's own defaults are five minutes each for headers and body, which is long enough
 * that a stalled connection reads as a hung command rather than a failed request -- the
 * operator gives up before the runtime does. So callers can set their own, and it is
 * opt-in per call because what counts as patient differs by endpoint: the Partner Portal
 * answers JSON in milliseconds, a log search over a month does not.
 *
 * Built on setTimeout rather than AbortSignal.timeout so that it composes with a signal
 * the caller already has, and stays visible to anything that controls the clock.
 */
const startDeadline = (timeout, callerSignal) => {
  const controller = new AbortController();
  let expired = false;

  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, timeout);
  // A deadline is a limit on waiting, never a reason to keep waiting.
  timer.unref?.();

  return {
    signal: callerSignal ? AbortSignal.any([callerSignal, controller.signal]) : controller.signal,
    expired: () => expired,
    clear: () => clearTimeout(timer)
  };
};

// Shaped like every other network failure rather than surfacing as a bare AbortError:
// ServerError reads .name and walks the cause chain to .code, and ETIMEDOUT is already
// the branch that says the server may be overloaded or unreachable.
const timedOutError = (uri, timeout) => {
  const error = new Error(`Request to ${uri} timed out after ${timeout}ms`);
  error.name = 'RequestError';
  error.code = 'ETIMEDOUT';
  error.options = { uri };
  return error;
};

const sendRequest = async (uri, fetchOptions, json) => {
  let response;
  try {
    response = await fetch(uri, fetchOptions);
  } catch (e) {
    const error = new Error(e.message);
    error.name = 'RequestError';
    error.cause = e;
    error.options = { uri };
    throw error;
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

// A body that is already bytes -- a file on its way to object storage -- is sent as it is.
// Only a plain object is JSON-encoded, which is what every other caller passes; a Buffer
// down that path would arrive as {"type":"Buffer","data":[...]}.
const isRawBody = (value) =>
  Buffer.isBuffer(value) || value instanceof Uint8Array || value instanceof ArrayBuffer;

const apiRequest = async ({ method = 'GET', uri, body, headers = {}, formData, json = true, forever, signal, timeout = null }) => {
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

  const deadline = timeout ? startDeadline(timeout, signal) : null;
  if (deadline) fetchOptions.signal = deadline.signal;
  else if (signal) fetchOptions.signal = signal;

  try {
    return await sendRequest(uri, fetchOptions, json);
  } catch (e) {
    // An abort reports where it was interrupted, not why. Only this frame knows the
    // request ran out of time rather than being cancelled by the caller.
    if (deadline?.expired()) throw timedOutError(uri, timeout);
    throw e;
  } finally {
    deadline?.clear();
  }
};

export { apiRequest };
