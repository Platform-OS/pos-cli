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
 * `classify` (run-tool.js) reads it off a thrown error, the `/_tests/*` tools read it off a
 * response that carries a status instead of throwing, and `sync-file` reads it off a response whose
 * body it has already opened. A status this does not recognise is the instance having refused.
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

export default ToolError;
