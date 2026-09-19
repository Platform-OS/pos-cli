/**
 * The one way a tool is called.
 *
 * A tool returns the data it produced, or throws. Everything a client sees around that — `ok`, the
 * error body, `meta` — is built here, so every transport reports the same call the same way and a
 * tool cannot invent a thirty-sixth envelope. Before this existed the shape was a convention, and
 * four tools had drifted off it: a failed migration reached clients as a successful call, because
 * the protocol layer derives `isError` from `ok === false` and those tools answered `status`.
 *
 * It also owns `meta`, which twenty-seven tools used to build for themselves.
 */
import { maskToken } from './auth.js';
import { ToolError, kindForStatus } from './tool-error.js';

/** The code for a failure the tool did not classify itself, one per kind this function assigns. */
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
 * What a thrown error means, when the tool did not say. The judgement is here rather than in each
 * tool's catch block, which is how twenty of them ended up reporting a 401, a 503 and a TypeError
 * under one code named after the tool.
 */
export function classify(err) {
  if (err instanceof ToolError) return err;

  const status = err?.statusCode ?? err?.status;
  const code = networkCode(err);
  const details = status ? { statusCode: status, ...(err?.response?.body !== undefined && { body: err.response.body }) } : undefined;
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

/**
 * Whether a handler returned the envelope this function builds. Narrow on purpose: `data.status`
 * alone is ordinary payload — a release record and a job both carry one — so the test is the
 * combination only our own envelope has.
 */
const isEnvelope = (data) =>
  data !== null && typeof data === 'object'
  && typeof data.ok === 'boolean' && (Object.hasOwn(data, 'data') || Object.hasOwn(data, 'error'));

/**
 * Runs one tool call and builds the result a client receives.
 *
 * @param {object} tool - a registry entry
 * @param {object} params - already validated against the tool's schema
 * @param {object} [ctx] - the per-call context handed to the handler; `resolveAuth` records what it
 *   resolved on it, which is where `meta.auth` comes from
 * @returns {Promise<{ok: true, data: unknown, meta: object} | {ok: false, error: object, meta: object}>}
 */
export async function runTool(tool, params, ctx = {}) {
  const startedAt = new Date().toISOString();
  // A copy: `resolveAuth` records on it, and a caller that reuses one context object across calls
  // — every test does — must not carry one call's credentials into the next.
  //
  // `mayChangeInstance` is derived here and overrides anything the caller put on ctx: which tools
  // may quietly land on an unnamed instance is the registry's decision, not a per-call one, and a
  // tool must not be able to exempt itself. `readOnlyHint` is the annotation MCP already defines
  // for this, so a new tool is covered by declaring what it is rather than by joining a list.
  // Absent annotations mean "may change things", which is the safe reading and MCP's own default.
  const call = { ...ctx, mayChangeInstance: tool?.annotations?.readOnlyHint !== true };

  const meta = () => {
    const auth = call.resolvedAuth;
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      ...(auth && { auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source } })
    };
  };

  try {
    const data = await tool.handler(params ?? {}, call);
    if (isEnvelope(data)) {
      // A tool that still builds its own envelope would otherwise be wrapped in a second one and
      // ship as a successful call with `data.ok` buried inside it. That is what a half-finished
      // conversion looks like, and it is silent, so it fails loudly here instead.
      throw ToolError.internal('DOUBLE_ENVELOPE', `${tool.name ?? 'tool'} returned a result envelope; a handler returns its data and throws to fail`);
    }
    return { ok: true, data: data ?? null, meta: meta() };
  } catch (err) {
    return { ok: false, error: classify(err).toResult(), meta: meta() };
  }
}

export default runTool;
