/**
 * The schema for a tool that declares none: one object, so what `tools/list` advertises and what
 * `validate-params.js` enforces cannot disagree. Open on purpose — a tool that published no schema
 * never promised to reject unknown parameters.
 */
const OPEN_OBJECT_SCHEMA = { type: 'object', properties: {} };

export { OPEN_OBJECT_SCHEMA };
export default OPEN_OBJECT_SCHEMA;
