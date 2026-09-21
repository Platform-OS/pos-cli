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
import { ToolError, classify } from './tool-error.js';

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
 * @param {object} [options] - the per-call context handed to the handler; `resolveAuth` records
 *   what it resolved on it, which is where `meta.auth` comes from
 * @param {string} [options.toolName] - the registry key, for diagnostics. Taken here rather than
 *   passed on: the name is the dispatcher's, not something a handler has any use for, and the
 *   handler context is a documented shape.
 * @returns {Promise<{ok: true, data: unknown, meta: object} | {ok: false, error: object, meta: object}>}
 */
export async function runTool(tool, params, { toolName, ...ctx } = {}) {
  const startedAt = new Date().toISOString();
  // `ctx` is already a copy, built by the rest above: `resolveAuth` records on it, and a caller
  // that reuses one context object across calls — every test does — must not carry one call's
  // credentials into the next.
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
      throw ToolError.internal('DOUBLE_ENVELOPE', `${toolName ?? 'a tool'} returned a result envelope; a handler returns its data and throws to fail`);
    }
    return { ok: true, data: data ?? null, meta: meta() };
  } catch (err) {
    return { ok: false, error: classify(err).toResult(), meta: meta() };
  }
}

export default runTool;
