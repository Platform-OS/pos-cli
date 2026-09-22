// platformos.liquid.exec tool - execute Liquid on remote instance via Gateway.liquid
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError } from '../tool-error.js';

/** What `{% assign %}` accepts on its left-hand side. */
const LIQUID_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

// `context` is the instance's own object, and the path every binding below reads through. Binding
// it would break the template and the bindings after it.
const RESERVED = new Set(['context']);

const bindable = (name) => LIQUID_NAME.test(name) && !RESERVED.has(name);

/**
 * Makes `locals` what its name says: top-level Liquid variables.
 *
 * The endpoint renders in a context where nothing the caller sends is a variable — measured against
 * a live instance on 2026-09-22, the whole request body lands at `context.params` and nowhere else,
 * so a template written the way this tool's own description showed (`Hello {{ name }}`) rendered
 * `Hello ` with `ok: true` and no error. Silently, which costs an agent more than a failure: it
 * cannot tell "the value did not arrive" from "my Liquid is wrong" from "the data is empty".
 *
 * So each local is bound by referring to where the instance put it. The value is never written into
 * the template — only the path is — so nothing has to be escaped and objects, arrays and booleans
 * arrive as themselves rather than as their JSON.
 *
 * **One line, no newline after it.** Liquid errors carry the line they happened on
 * (`Liquid error (line 3)`, and `diagnostic.stack[].line`), and those are the caller's only way to
 * find a fault in its own template. A prefix ending in a newline shifts every one of them by one.
 *
 * A template's own `assign` of the same name still wins, since it runs after. With no locals the
 * template is passed through untouched.
 */
const bindLocals = (template, locals) => {
  const names = Object.keys(locals ?? {});
  const bound = names.filter(bindable);

  return {
    content: bound.map(name => `{% assign ${name} = context.params.locals.${name} %}`).join('') + template,
    unbound: names.filter(name => !bindable(name))
  };
};

const execLiquidTool = {
  description: 'Render a Liquid template on an instance and return the output. To run a query, use graphql-exec: this is for rendering. Rendering is not a deployability check either — the deploy converter rejects source that this accepts.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      template: { type: 'string', description: 'Template source, e.g. "Hello {{ name }}".' },
      locals: {
        type: 'object',
        additionalProperties: true,
        description: 'Values the template reads as top-level Liquid variables, and at context.params.locals — where a key that is not a Liquid name stays, reported as unboundLocals.'
      }
    },
    required: ['template']
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);
    // The request URL comes from the resolved credentials only (see graphql-exec).
    const baseUrl = auth.url;

    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    const { content, unbound } = bindLocals(params.template, params.locals);

    // `locals` still travels as itself: it is what the bindings read through, and it is the only
    // way an unbindable key can be reached at all. The instance's own parameter wrapping copies the
    // whole body a second time under `liquid_exec` — that duplication is the platform's and is not
    // sent twice from here.
    const resp = await gateway.liquid({ content, locals: params.locals || {} });

    // The endpoint answers 200 with a Liquid error payload, so a failure has to be read out of the
    // body. The instance rendered it and refused: its judgement, not a broken call.
    //
    // The marker, not the word: this looked for `error` anywhere in the output, so a template that
    // rendered the word — a page about errors, a message saying there was none — came back as a
    // failed call with its own output as the message. A real failure renders `Liquid error`, and
    // it is matched anywhere in the output because a template can fail after partly rendering.
    const respError = resp && (resp.error || resp.errors);
    const rendered = typeof resp?.result === 'string' ? resp.result : '';

    if (respError || /liquid error/i.test(rendered)) {
      const message = String(resp?.error || resp?.errors || resp?.result || 'Liquid execution failed');
      throw ToolError.instance('LIQUID_EXEC_ERROR', message, resp);
    }

    // The endpoint's own `error` is not returned: it is null on every call that gets this far, and
    // a field that is always null invites a check that never fires. A real one is thrown above.
    // `unboundLocals` appears only when there is one, so the ordinary call pays nothing for it.
    return { result: rendered, ...(unbound.length > 0 && { unboundLocals: unbound }) };
  }
};

export default execLiquidTool;
