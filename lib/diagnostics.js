// Renders a structured Liquid diagnostic (the `data` payload the platformOS
// backend attaches to a log entry, TASK-18.2) into developer-friendly, CI-safe
// terminal text: a compiler-style `path:line: type: message` header, the offending
// source span, the include/render stack as a conventional innermost-first trace,
// and request context.
//
// `data.stack` is an array of { path, line } frames, innermost-first (stack[0] is
// the error location); there is no separate `location` field.
//
// Returns `null` when `data` is not a structured diagnostic this version
// understands (missing payload, legacy `{% log %}` context hash, or an unknown
// schema_version). Callers degrade gracefully to the `rendered` string or the log
// message in that case. Output uses no color-only signalling (readable in CI).

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

const contextParts = (context = {}) => {
  const parts = [];
  if (context.url) parts.push(`url: ${context.url}`);
  if (context.user && context.user.email) parts.push(`email: ${context.user.email}`);
  return parts;
};

const formatDiagnostic = (data) => {
  if (!isStructuredDiagnostic(data)) return null;

  const lines = [];
  const stack = Array.isArray(data.stack) ? data.stack : [];

  // Compiler-style header: "path:line: type: message" (location is stack[0]).
  const header = [frameLabel(stack[0]), data.type, data.message].filter(Boolean).join(': ');
  if (header) lines.push(header);

  if (data.source_span) lines.push(`  ${data.source_span}`);

  // Full trace, innermost-first. Skip when there is only the leaf frame (already
  // shown in the header) so single-location errors stay compact.
  if (stack.length > 1) {
    lines.push('  stack:');
    stack.forEach((frame) => lines.push(`    ${frameLabel(frame) || '(unknown)'}`));
  }

  const ctx = contextParts(data.context);
  if (ctx.length > 0) lines.push(`  ${ctx.join('  ')}`);

  return lines.length > 0 ? lines.join('\n') : null;
};

export { formatDiagnostic, isStructuredDiagnostic, displayType, frameLabel, SUPPORTED_SCHEMA_VERSION };
