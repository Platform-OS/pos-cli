import { validate } from '../lib/validation/index.js';
import log from './log.js';

// Tools that declare no schema accept any object — which is exactly what the transports
// already advertise on their behalf in tools/list.
const OPEN_SCHEMA = { type: 'object' };

/**
 * Validate tool params against the tool's advertised `inputSchema`.
 *
 * Both transports call this before handing params to a handler, so the schema shown to
 * clients in tools/list is the schema those params are actually checked against.
 *
 * @param {string} name - tool name, for logging
 * @param {object} tool - tool entry from tools.js
 * @param {*} params - untrusted params from the client
 * @returns {{valid: boolean, errors?: Array, message?: string, schemaError?: boolean}}
 */
const validateToolParams = (name, tool, params) => {
  const result = validate(tool.inputSchema || OPEN_SCHEMA, params ?? {});

  if (!result.valid) {
    log.debug('tool params rejected', {
      tool: name,
      message: result.message,
      schemaError: Boolean(result.schemaError)
    });
  }

  return result;
};

export { validateToolParams };
export default validateToolParams;
