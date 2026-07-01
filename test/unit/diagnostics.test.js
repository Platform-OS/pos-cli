/**
 * Unit tests for the structured Liquid diagnostic renderer (TASK-18.3).
 * Covers the structured-render path and graceful fallback.
 */
import { describe, test, expect } from 'vitest';
import { formatDiagnostic, isStructuredDiagnostic, displayType, frameLabel } from '#lib/diagnostics.js';

// A full structured diagnostic as produced by the backend (TASK-18.2), matching
// the schema_version: 1 shape persisted in the log entry's `data` payload. `stack`
// is innermost-first { path, line } frames; stack[0] is the error location.
const diagnostic = (overrides = {}) => ({
  schema_version: 1,
  type: 'GraphqlTagError',
  message: 'Couldn\'t find "missing.graphql".',
  stack: [{ path: 'views/pages/mytest.liquid', line: 6 }],
  context: {},
  source_span: null,
  timestamp: '2026-06-24T11:24:44Z',
  ...overrides
});

describe('isStructuredDiagnostic', () => {
  test('true only for schema_version 1 objects', () => {
    expect(isStructuredDiagnostic(diagnostic())).toBe(true);
  });

  test('false for the legacy {% log %} context hash (no schema_version)', () => {
    expect(isStructuredDiagnostic({ url: 'example.com/x', page: 'home' })).toBe(false);
  });

  test('false for an unknown schema_version', () => {
    expect(isStructuredDiagnostic(diagnostic({ schema_version: 99 }))).toBe(false);
  });

  test('false for null/undefined/non-objects', () => {
    expect(isStructuredDiagnostic(null)).toBe(false);
    expect(isStructuredDiagnostic(undefined)).toBe(false);
    expect(isStructuredDiagnostic('nope')).toBe(false);
  });
});

describe('displayType', () => {
  test("uses the error class (data.type) for errors", () => {
    expect(displayType({ error_type: 'Liquid error', data: { schema_version: 1, type: 'GraphqlTagError' } })).toBe('GraphqlTagError');
  });

  test("uses the log's own error_type when there is no error class", () => {
    expect(displayType({ error_type: 'yo', data: { schema_version: 1, stack: [], context: {} } })).toBe('yo');
  });

  test("falls back to 'Log' when there is no type at all", () => {
    expect(displayType({ data: { schema_version: 1 } })).toBe('Log');
    expect(displayType({})).toBe('Log');
  });
});

describe('frameLabel', () => {
  test('formats path:line, path-only, line-only, and empty frames', () => {
    expect(frameLabel({ path: 'a.liquid', line: 3 })).toBe('a.liquid:3');
    expect(frameLabel({ path: 'a.liquid', line: null })).toBe('a.liquid');
    expect(frameLabel({ path: null, line: 3 })).toBe('line 3');
    expect(frameLabel({ path: null, line: null })).toBeNull();
    expect(frameLabel(undefined)).toBeNull();
  });
});

describe('formatDiagnostic - structured render', () => {
  test('renders a compiler-style path:line: type: message header from stack[0]', () => {
    expect(formatDiagnostic(diagnostic())).toBe(
      'views/pages/mytest.liquid:6: GraphqlTagError: Couldn\'t find "missing.graphql".'
    );
  });

  test('uses "line N" when only the line is known', () => {
    const d = diagnostic({ stack: [{ path: null, line: 6 }] });
    expect(formatDiagnostic(d)).toBe('line 6: GraphqlTagError: Couldn\'t find "missing.graphql".');
  });

  test('omits the location when the stack is empty', () => {
    const d = diagnostic({ stack: [] });
    expect(formatDiagnostic(d)).toBe('GraphqlTagError: Couldn\'t find "missing.graphql".');
  });

  test('includes the offending source_span', () => {
    const d = diagnostic({ source_span: 'in "{% graphql res = "missing" %}"' });
    expect(formatDiagnostic(d)).toBe(
      'views/pages/mytest.liquid:6: GraphqlTagError: Couldn\'t find "missing.graphql".\n' +
        '  in "{% graphql res = "missing" %}"'
    );
  });

  test('renders the full innermost-first stack when there is more than one frame', () => {
    const d = diagnostic({
      stack: [
        { path: 'views/partials/inner.liquid', line: 2 },
        { path: 'views/partials/outer.liquid', line: 1 },
        { path: 'views/pages/mytest.liquid', line: 3 }
      ]
    });
    expect(formatDiagnostic(d)).toBe(
      'views/partials/inner.liquid:2: GraphqlTagError: Couldn\'t find "missing.graphql".\n' +
        '  stack:\n' +
        '    views/partials/inner.liquid:2\n' +
        '    views/partials/outer.liquid:1\n' +
        '    views/pages/mytest.liquid:3'
    );
  });

  test('does not render a stack section for a single-frame (leaf-only) trace', () => {
    expect(formatDiagnostic(diagnostic())).not.toContain('stack:');
  });

  test('renders request context (url, email)', () => {
    const d = diagnostic({
      context: { url: 'community.lvh.me/mytest', user: { id: 1, email: 'a@b.com' } }
    });
    expect(formatDiagnostic(d)).toBe(
      'views/pages/mytest.liquid:6: GraphqlTagError: Couldn\'t find "missing.graphql".\n' +
        '  url: community.lvh.me/mytest  email: a@b.com'
    );
  });
});

describe('formatDiagnostic - {% log %} shape (no type/message/source_span)', () => {
  // A {% log %} entry shares the structured shape but carries only stack + context
  // (the log value lives in the entry's own message). It renders as a location
  // header + context, no error type.
  const logData = {
    schema_version: 1,
    stack: [{ path: 'views/partials/widget.liquid', line: 7 }],
    context: { url: 'community.lvh.me/mytest' }
  };

  test('renders the location and context without a type or message', () => {
    expect(formatDiagnostic(logData)).toBe(
      'views/partials/widget.liquid:7\n  url: community.lvh.me/mytest'
    );
  });
});

describe('formatDiagnostic - graceful fallback (returns null)', () => {
  test('returns null for a missing payload so callers fall back to the message', () => {
    expect(formatDiagnostic(null)).toBeNull();
    expect(formatDiagnostic(undefined)).toBeNull();
  });

  test('returns null for the legacy {% log %} context hash', () => {
    expect(formatDiagnostic({ url: 'example.com/x', page: 'home', partial: 'p' })).toBeNull();
  });

  test('returns null for an unknown schema_version (forward-compat)', () => {
    expect(formatDiagnostic(diagnostic({ schema_version: 2 }))).toBeNull();
  });
});
