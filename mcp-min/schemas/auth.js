/**
 * Shared input-schema fragment for the explicit-credentials path.
 *
 * `resolveAuth` (mcp-min/auth.js) accepts `url` + `email` + `token` on the params of
 * every tool that authenticates, ahead of the `.pos` environment lookup. Tools that
 * close their schema with `additionalProperties: false` must therefore declare these
 * three, or validation would reject the very callers that path exists to serve.
 *
 * Spread into every authenticating tool rather than restated inline, so `tools/list`
 * documents the same three parameters identically everywhere. The invariant is enforced
 * by mcp-min/__tests__/validate-params.test.js, which derives the tool list from the
 * registry rather than a hand-written list.
 *
 * `env` is deliberately not included: it is required on some tools and optional on
 * others, and its description varies, so it stays declared per tool.
 */
const authProperties = {
  url: {
    type: 'string',
    format: 'uri',
    description: 'Instance URL (with email and token, bypasses .pos)'
  },
  email: {
    type: 'string',
    format: 'email',
    description: 'Account email (with url and token, bypasses .pos)'
  },
  token: {
    type: 'string',
    description: 'API token (with url and email, bypasses .pos)'
  }
};

export { authProperties };
export default authProperties;
