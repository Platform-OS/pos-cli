// A GraphQL request that fails validation/parsing still resolves with HTTP 200
// (errors come back in the body, not as a rejected request), so callers must
// check this before assuming `msg.data` is present.
const graphQLErrorMessage = (msg) => {
  if (msg && Array.isArray(msg.errors) && msg.errors.length > 0) {
    return msg.errors.map(e => e.message).join(', ');
  }
  return null;
};

export { graphQLErrorMessage };
