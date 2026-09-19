// platformos.liquid.exec tool - execute Liquid on remote instance via Gateway.liquid
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError } from '../tool-error.js';

const execLiquidTool = {
  description: 'Render a Liquid template on an instance and return the output. To run a query, use graphql-exec: this is for rendering. Rendering is not a deployability check either — the deploy converter rejects source that this accepts.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      template: { type: 'string', description: 'Template source, e.g. "Hello {{ name }}".' },
      locals: { type: 'object', additionalProperties: true, description: 'Values the template can read as top-level Liquid variables.' }
    },
    required: ['template']
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);
    // The request URL comes from the resolved credentials only (see graphql-exec).
    const baseUrl = auth.url;

    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    const body = {
      content: params.template,
      locals: params.locals || {}
    };

    const resp = await gateway.liquid(body);

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

    return resp;
  }
};

export default execLiquidTool;
