/*
  Helpers for the structured Liquid diagnostic (the `data` payload the backend
  attaches to a log entry, TASK-18.2). Mirrors lib/diagnostics.js used by the CLI.

  A log entry's `data` can be one of:
    - a structured diagnostic: { schema_version: 1, type, message, stack, context,
      source_span, timestamp }. `stack` is an array of { path, line } frames,
      innermost-first (stack[0] is the error location).
    - the legacy {% log %} context hash: { url, page, partial, user }
    - absent (historical entries)

  Consumers must tolerate all three and degrade gracefully.
*/

const SUPPORTED_SCHEMA_VERSION = 1;

const isStructuredDiagnostic = (data) =>
  !!data && typeof data === 'object' && data.schema_version === SUPPORTED_SCHEMA_VERSION;

// The type label shown for a log entry: an error's class (data.type), else the
// log's own type (error_type, e.g. 'yo'/'info'/'error'), else a generic 'Log'.
const displayType = (log) => (log && log.data && log.data.type) || (log && log.error_type) || 'Log';

// "path:line", "path", "line N", or null — a single stack frame's label.
const frameLabel = (frame) => {
  if (!frame) return null;
  if (typeof frame === 'string') return frame; // tolerate legacy string frames
  if (frame.path) return frame.line != null ? `${frame.path}:${frame.line}` : `${frame.path}`;
  if (frame.line != null) return `line ${frame.line}`;
  return null;
};

export { isStructuredDiagnostic, displayType, frameLabel, SUPPORTED_SCHEMA_VERSION };
