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
 * process. The number is the largest bound this repository already uses (`RELEASE_TIMEOUT_MS`).
 */
export const RESPONSE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * A request whose body is a file. Headers cannot arrive until the upload has finished, so the
 * bound has to cover sending it: a release archive may be 50MB, which is minutes on a slow link.
 */
export const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

// Exactly the values `buildFormData` turns into a file part; the two must agree, or a request that
// uploads one gets the bound meant for a request that does not.
const carriesAFile = (formData) => !!formData && Object.values(formData)
  .some(value => Buffer.isBuffer(value) || (value && typeof value === 'object' && value.path));

/**
 * The deadline for one request: a signal to hand `fetch`, and a way to ask afterwards whether it
 * was this that ended the call rather than the caller cancelling.
 */
export const responseDeadline = ({ signal, timeoutMs = RESPONSE_TIMEOUT_MS }) => {
  const deadline = new AbortController();
  let expired = false;
  const timer = setTimeout(() => { expired = true; deadline.abort(); }, timeoutMs);

  return {
    // The caller's signal still cancels; this only adds a second way for the wait to end.
    signal: signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal,
    reached: () => expired,
    clear: () => clearTimeout(timer)
  };
};

/**
 * `code` is what `classify` reads: `ETIMEDOUT` is already in its unreachable set, so a timeout
 * arrives as `unavailable` with the host named, the same as a refused connection.
 */
export const timedOut = (uri, timeoutMs, cause) => Object.assign(
  new Error(`No response in ${Math.round(timeoutMs / 1000)}s`),
  { name: 'RequestError', code: 'ETIMEDOUT', cause, options: { uri } }
);

const apiRequest = async ({ method = 'GET', uri, body, headers = {}, formData, json = true, forever, signal, timeoutMs }) => {
  logger.Debug(`[${method}] ${uri}`);

  const fetchOptions = {
    method,
    headers: { ...headers }
  };


  if (formData) {
    const form = buildFormData(formData);
    fetchOptions.body = form;
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

  const waitMs = timeoutMs ?? (carriesAFile(formData) ? UPLOAD_TIMEOUT_MS : RESPONSE_TIMEOUT_MS);
  const deadline = responseDeadline({ signal, timeoutMs: waitMs });
  fetchOptions.signal = deadline.signal;

  let response;
  try {
    response = await fetch(uri, fetchOptions);
  } catch (e) {
    if (deadline.reached()) throw timedOut(uri, waitMs, e);
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

export { apiRequest };
