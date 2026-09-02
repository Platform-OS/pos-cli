import { validate } from '../lib/validation/index.js';
import { OPEN_OBJECT_SCHEMA } from './schemas/default.js';
import log from './log.js';

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
  const result = validate(tool.inputSchema || OPEN_OBJECT_SCHEMA, params ?? {});

  if (!result.valid) {
    log.debug('tool params rejected', {
      tool: name,
      message: result.message,
      schemaError: Boolean(result.schemaError)
    });
  }

  return result;
};

/**
 * Validate tool params and, if they are rejected, describe the rejection in the terms
 * both transports need.
 *
 * The status mapping lives here rather than at each call site so there is exactly one
 * decision about how a rejection is reported. A schema that will not compile is our own
 * defect, so it is a server error (500 / -32603) rather than the caller's fault
 * (400 / -32602) — but either way the call is rejected, because a schema that did not
 * compile checked nothing.
 *
 * @param {string} name - tool name, for logging
 * @param {object} tool - tool entry from tools.js
 * @param {*} params - untrusted params from the client
 * @returns {null|{httpStatus: number, jsonRpcCode: number, message: string, errors: Array}}
 *   null when the params are valid.
 */
const rejectionFor = (name, tool, params) => {
  const result = validateToolParams(name, tool, params);
  if (result.valid) return null;

  return {
    httpStatus: result.schemaError ? 500 : 400,
    jsonRpcCode: result.schemaError ? -32603 : -32602,
    message: result.message,
    errors: result.errors
  };
};

export { validateToolParams, rejectionFor };
export default validateToolParams;
