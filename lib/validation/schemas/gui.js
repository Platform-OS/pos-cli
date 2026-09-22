/**
 * Request schemas for the local GUI server (lib/server.js).
 *
 * These endpoints proxy straight through to the connected platformOS instance, and
 * lib/server.js sets `Access-Control-Allow-Origin: *`, so any page open in the
 * developer's browser can reach them while the GUI is running. Validating here rejects
 * malformed input before it is forwarded with the user's API token attached.
 *
 * The schemas stay open (`additionalProperties: true`) on purpose. The pages that call
 * these endpoints are pre-built bundles (GraphiQL in particular sends whatever its
 * fetcher assembles), so pinning an exact property set would risk rejecting a legitimate
 * field we cannot see from here. What is checked is what the handlers actually depend
 * on: that the payload is an object and that its known fields have workable types.
 */

const graphqlRequestSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['query'],
  properties: {
    query: { type: 'string', minLength: 1 },
    variables: { type: ['object', 'null'] },
    operationName: { type: ['string', 'null'] }
  }
};

const liquidRequestSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['content'],
  properties: {
    content: { type: 'string' }
  }
};

// Mirrors what Gateway.logsv2 branches on (`query`, then `key`, then a plain SQL search)
// and what swagger-client's buildQuery/searchAround read off the params.
//
// `query` accepts a string as well as an object because that branch forwards the whole
// params object as the request body, and the GET route can only ever deliver a string.
const logsSearchSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    query: { type: ['object', 'string'] },
    key: { type: 'string' },
    stream_name: { type: 'string' },
    sql: { type: 'string' },
    size: { type: 'integer', minimum: 0 },
    from: { type: 'integer', minimum: 0 },
    start_time: { type: 'integer' },
    end_time: { type: 'integer' }
  }
};

// A log row id as the instance writes it: a microsecond epoch, `"1790008926.7639065"`, a string in
// every row it sends. Declared `integer`, it 400'd the admin Logs page on every poll after the
// first rows arrived; truncating is no fix either, since `last_id` is a strict greater-than, so a
// cursor without its fraction re-delivers every row from the same second.
//
// The pattern, not the type, is what stops a caller appending their own query parameters — and
// `Gateway.logs` encodes the value as well, so neither guard stands alone.
//
// `default: '0'` matters: 0 is the "from the beginning" sentinel logStream.js already uses, so a
// first poll with no cursor resolves to it instead of interpolating "undefined" into the URL.
//
// Exported: `logs-fetch` (mcp-min/logs/fetch.js) publishes the same shape, so the cursor has one
// type wherever it travels.
const ROW_ID = '^[0-9]+(\\.[0-9]+)?$';

const logsRequestSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    lastId: { type: 'string', pattern: ROW_ID, default: '0' }
  }
};

// The file itself arrives via multer, not JSON, so only `path` is schema-checkable here.
const syncRequestSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['path'],
  properties: {
    path: { type: 'string', minLength: 1 }
  }
};

export { ROW_ID, graphqlRequestSchema, liquidRequestSchema, logsRequestSchema, logsSearchSchema, syncRequestSchema };
