// A GraphQL request that fails validation/parsing still resolves with HTTP 200
// (errors come back in the body, not as a rejected request), so callers must
// check this before assuming `msg.data` is present.
//
// Zero imports on purpose: the GUI bundles (gui/admin, gui/next) are separate
// packages built by their own rollup/vite and pull this in by relative path.
// Anything Node-only added here would break those builds.

// The raw errors array, or null when the response carries none. Callers that
// need `locations` / `path` / `extensions` — the GraphQL exec surfaces — use
// this and keep the full detail.
//
// An empty `errors: []` counts as no errors: the spec says the field is omitted
// when nothing failed, so treating `[]` as a failure would reject successful
// responses that happen to spell it that way.
const graphQLErrors = (msg) => {
  if (msg && Array.isArray(msg.errors) && msg.errors.length > 0) {
    return msg.errors;
  }
  return null;
};

// Collapses an errors array into one human-readable line. Every error is kept —
// reporting only `errors[0]` hides the rest of a multi-error response.
const formatGraphQLErrors = (errors) => {
  return (errors || []).map(e => e.message).join(', ');
};

// The common "give me one message, or nothing" case.
const graphQLErrorMessage = (msg) => {
  const errors = graphQLErrors(msg);
  return errors ? formatGraphQLErrors(errors) : null;
};

export { graphQLErrors, formatGraphQLErrors, graphQLErrorMessage };
