/**
 * How a tool says a call did not do what was asked.
 *
 * `ok: false` on its own is too coarse to act on: "env staging is not in .pos", "the instance
 * refused the token", "the connection was refused" and "pos-cli threw a TypeError" all reached the
 * client as the same thing, under one of twenty catch-all codes — `DEPLOY_START_ERROR`,
 * `MIGRATIONS_LIST_ERROR` — that named the tool the caller already knew it had called.
 *
 * So an error carries a `kind` as well as a `code`. The kind is a closed set, and each member
 * answers one question: what should the caller do next. The code stays for precision, and is what
 * an agent branches on when it wants to handle one specific failure.
 */

/** The closed set, with the next action each one implies. */
export const ERROR_KINDS = Object.freeze({
  input: 'the arguments were wrong; change them and call again',
  not_found: 'what the arguments named is not there',
  auth: 'the credentials were rejected or missing; re-authenticate rather than retry',
  project: 'the project or machine is not ready for this',
  instance: 'the instance ran it and refused; the message says why',
  unavailable: 'nothing was decided; the same call may work later',
  internal: 'a defect in pos-cli',
  cancelled: 'the client stopped the call'
});

export class ToolError extends Error {
  /**
   * @param {keyof ERROR_KINDS} kind
   * @param {string} code - stable, and specific enough to branch on
   * @param {string} message - for a person, and for a model deciding what to do
   * @param {object} [details] - whatever the caller needs to act, e.g. a status code or a file path
   */
  constructor(kind, code, message, details) {
    super(message);
    // A typo in a kind would publish a classification no caller can act on, and it would read as
    // a valid one. Loud here, where it is a programming error, rather than quiet on the wire.
    if (!Object.hasOwn(ERROR_KINDS, kind)) {
      throw new TypeError(`ToolError: ${kind} is not one of ${Object.keys(ERROR_KINDS).join(', ')}`);
    }
    this.name = 'ToolError';
    this.kind = kind;
    this.code = code;
    if (details !== undefined) this.details = details;
  }

  /** The body a client receives. */
  toResult() {
    return { kind: this.kind, code: this.code, message: this.message, ...(this.details !== undefined && { details: this.details }) };
  }
}

/**
 * The kind an HTTP status implies.
 *
 * One table, because three places need the same judgement and a second copy is a second answer:
 * `classify` below reads it off a thrown error, the `/_tests/*` tools read it off a response that
 * carries a status instead of throwing, and `sync-file` reads it off a response whose body it has
 * already opened. A status this does not recognise is the instance having refused.
 */
export const kindForStatus = (status) => {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429 || status >= 500) return 'unavailable';
  return 'instance';
};

// Named after the kind, so a call site cannot mistype one and cannot put the code where the kind
// goes: `ToolError.input('VALIDATION_ERROR', 'Provide one of: filePath or jsonData')`.
for (const kind of Object.keys(ERROR_KINDS)) {
  ToolError[kind] = (code, message, details) => new ToolError(kind, code, message, details);
}

/** The code for a failure the thrower did not classify, one per kind `classify` assigns. */
const UNCLASSIFIED = {
  auth: 'UNAUTHORIZED',
  not_found: 'NOT_FOUND',
  unavailable: 'INSTANCE_UNAVAILABLE',
  instance: 'INSTANCE_REFUSED',
  internal: 'INTERNAL_ERROR'
};

// A network failure keeps its code two or three `cause` levels down (CLAUDE.md), so the chain is
// walked rather than read at the top.
const networkCode = (err, depth = 0) => {
  if (!err || depth > 5) return null;
  if (typeof err.code === 'string') return err.code;
  return networkCode(err.cause, depth + 1);
};

const UNREACHABLE = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN']);

/**
 * A ceiling on an upstream body that is not JSON, which the model pays for in tokens while it is
 * already dealing with a failure.
 *
 * `apiRequest` parses the body as JSON when it can, so a string here means the instance or
 * something in front of it answered with a page instead. Measured against a real instance: an
 * error page is 1,430 bytes (404) to 2,062 bytes (503), and a JSON or plain-text error is 10 to 27
 * — so nothing observed reaches this, and it exists for the tail we cannot measure from one
 * instance, such as a CDN's 502 or an application backtrace. Parsed JSON is never cut: it is small
 * and structured, and it is what carries the file path a failed deploy names.
 *
 * The head is kept rather than the tail because that is where the reason is — `<title>Oops
 * (503)</title>` sits in the first 200 bytes of both pages measured.
 */
export const MAX_ERROR_BODY_LENGTH = 4096;

const boundedBody = (body) => {
  if (typeof body !== 'string' || body.length <= MAX_ERROR_BODY_LENGTH) return body;
  return `${body.slice(0, MAX_ERROR_BODY_LENGTH)}… (${body.length - MAX_ERROR_BODY_LENGTH} more characters)`;
};

/**
 * What a thrown error means, when whatever threw it did not say. It lives here rather than with
 * the invoker because it is the same judgement `kindForStatus` is: a tool that needs it must not
 * have to import `run-tool.js`, which is the thing that calls tools.
 *
 * Having it in one place is how twenty tools stopped reporting a 401, a 503 and a TypeError under
 * one code named after the tool.
 */
export function classify(err) {
  if (err instanceof ToolError) return err;

  const status = err?.statusCode ?? err?.status;
  const code = networkCode(err);
  const details = status ? { statusCode: status, ...(err?.response?.body !== undefined && { body: boundedBody(err.response.body) }) } : undefined;
  const message = String(err?.message || err);

  if (err?.name === 'RequestError' || (code && UNREACHABLE.has(code))) {
    return ToolError.unavailable(code && UNREACHABLE.has(code) ? code : UNCLASSIFIED.unavailable, message, details);
  }
  // Only a status decides a kind here; without one there is nothing to read, and a guess would be
  // a worse answer than "we do not know what this is".
  if (status >= 400) {
    const kind = kindForStatus(status);
    return new ToolError(kind, UNCLASSIFIED[kind], message, details);
  }

  return ToolError.internal(UNCLASSIFIED.internal, message);
}

export default ToolError;
