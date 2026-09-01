import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Runtime input validation, backed by Ajv (JSON Schema draft-07).
 *
 * Every MCP tool in mcp-min/ already declares its `inputSchema` as JSON Schema, and
 * that same object is advertised to clients verbatim in `tools/list`. Validating
 * against it means the contract we publish and the contract we enforce are one
 * object — there is no second definition that can drift out of sync.
 */

// Two Ajv instances, because the two input shapes need different treatment:
//
//   strict   - JSON request bodies. Values arrive with real types, so nothing is
//              rewritten and the caller's data is left untouched.
//   coercing - query strings. Every value arrives as a string, so `?size=100` has to
//              become a number before `{ type: 'integer' }` can accept it. Ajv applies
//              coercion and defaults by mutating the validated object in place, which
//              is what callers reading `req.query` afterwards want.
// strict mode stays on so a malformed schema fails loudly at compile time rather than
// silently validating nothing. `allowUnionTypes` is the one rule relaxed: fields that
// legitimately accept more than one type exist (a search payload that arrives as an
// object over POST and as a string over GET), and Ajv otherwise rejects the schema.
const buildInstance = options => {
  const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true, ...options });
  addFormats(ajv);
  return { ajv, compiled: new WeakMap() };
};

const instances = {
  strict: buildInstance({}),
  coercing: buildInstance({ coerceTypes: true, useDefaults: true })
};

// Schemas are stable module-level objects, so a WeakMap keyed on the schema keeps one
// compiled validator per schema for the process lifetime without pinning it in memory.
const validatorFor = (schema, mode) => {
  const instance = instances[mode];
  if (!instance) throw new Error(`Unknown validation mode: ${mode}`);

  let validator = instance.compiled.get(schema);
  if (!validator) {
    validator = instance.ajv.compile(schema);
    instance.compiled.set(schema, validator);
  }
  return validator;
};

// Ajv's raw messages drop the detail that matters most for the two failures callers hit
// constantly: which property is missing, and which unknown one was rejected.
const describeError = error => {
  const at = error.instancePath || '(root)';

  switch (error.keyword) {
    case 'required':
      return `${at} is missing required property '${error.params.missingProperty}'`;
    case 'additionalProperties':
      return `${at} has unknown property '${error.params.additionalProperty}'`;
    default:
      return `${at} ${error.message}`;
  }
};

const MESSAGE_ERROR_LIMIT = 5;

const summarize = errors => {
  const shown = errors.slice(0, MESSAGE_ERROR_LIMIT).map(error => error.message);
  const hidden = errors.length - shown.length;
  return hidden > 0 ? `${shown.join('; ')} (+${hidden} more)` : shown.join('; ');
};

/**
 * Validate `data` against `schema`.
 *
 * @param {object} schema - JSON Schema (draft-07)
 * @param {*} data - value to validate; with mode 'coercing' it is mutated in place
 * @param {object} [options]
 * @param {'strict'|'coercing'} [options.mode] - see the instances above
 * @returns {{valid: boolean, data: *, errors?: Array<{path: string, message: string}>,
 *            message?: string, schemaError?: boolean}}
 *   `schemaError` marks a schema that failed to compile. That is a defect in our own
 *   schema rather than bad input, so callers should report it as a server-side error —
 *   but still reject the call, since an uncompilable schema means nothing was checked.
 */
const validate = (schema, data, { mode = 'strict' } = {}) => {
  let validator;
  try {
    validator = validatorFor(schema, mode);
  } catch (err) {
    const message = `Schema failed to compile: ${err.message}`;
    return { valid: false, data, schemaError: true, message, errors: [{ path: '(schema)', message }] };
  }

  if (validator(data)) return { valid: true, data };

  const errors = (validator.errors || []).map(error => ({
    path: error.instancePath || '(root)',
    message: describeError(error)
  }));

  return { valid: false, data, errors, message: summarize(errors) };
};

export { validate, describeError };
export default validate;
