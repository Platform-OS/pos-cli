import { validate } from '../lib/validation/index.js';
import { OPEN_OBJECT_SCHEMA } from './schemas/default.js';
import log from './log.js';

// MCP 2026-07-28 assigns JSON Schema 2020-12 to a schema without `$schema`, and tool schemas
// are published without one, so that is the dialect they mean and are enforced in.
const TOOL_SCHEMA_DIALECT = '2020-12';

/**
 * Validate tool params against the tool's advertised `inputSchema`, so the schema shown in
 * tools/list is the schema those params are checked against.
 */
const validateToolParams = (name, tool, params) => {
  const result = validate(tool.inputSchema || OPEN_OBJECT_SCHEMA, params ?? {}, { dialect: TOOL_SCHEMA_DIALECT });

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
 * A rejection described in the terms both transports need, or null when the params are valid.
 *
 * A schema that will not compile is our own defect, so it is a server error rather than the
 * caller's fault — but either way the call is rejected, because nothing was checked.
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

/**
 * The tool schema's compile error, or null when it is usable — what `createServerFactory` probes
 * every exposed tool with at startup. Not `validateToolParams`, because probing with `{}` rejects
 * every tool that requires a property and would log thirty meaningless rejections under DEBUG.
 */
const schemaCompileError = (tool) => {
  const result = validate(tool.inputSchema || OPEN_OBJECT_SCHEMA, {}, { dialect: TOOL_SCHEMA_DIALECT });
  return result.schemaError ? result.message : null;
};

export { validateToolParams, rejectionFor, schemaCompileError, TOOL_SCHEMA_DIALECT };
