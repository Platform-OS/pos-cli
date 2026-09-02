/**
 * The schema used for a tool that declares no `inputSchema` of its own.
 *
 * There is exactly one of these because the same object has to serve both roles: what
 * the transports advertise in `tools/list` and what the enforcement path in
 * validate-params.js actually checks against. Three separate literals previously
 * disagreed about whether the default was open or closed, which is precisely the drift
 * that validating each tool's own advertised schema is meant to rule out.
 *
 * It stays open (no `additionalProperties: false`): a tool that declared no schema never
 * promised to reject unknown parameters, and enforcement must not invent a contract that
 * `tools/list` did not publish. Every registered tool declares its own closed schema, so
 * this is a fallback rather than a live policy.
 */
const OPEN_OBJECT_SCHEMA = { type: 'object', properties: {} };

export { OPEN_OBJECT_SCHEMA };
export default OPEN_OBJECT_SCHEMA;
