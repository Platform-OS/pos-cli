/**
 * The credential parameters every authenticating tool spreads into its schema.
 *
 * A tool closing its schema with `additionalProperties: false` must spread all three, or the
 * explicit-credentials path `resolveAuth` serves becomes unreachable; `__tests__/validate-params.test.js`
 * derives the tool list from the registry and enforces that.
 *
 * Wording is terse on purpose: this object is published by twenty-one tools on every request, so
 * the full precedence lives in the server instructions, sent once. See CLAUDE.md.
 */
const authProperties = {
  env: {
    type: 'string',
    description: 'Which environment in .pos to use.'
  },
  url: { type: 'string', format: 'uri', description: 'Instance URL; with email and token, used instead of env.' },
  email: { type: 'string', format: 'email', description: 'Account email, with url and token.' },
  token: { type: 'string', description: 'API token, with url and email.' }
};

export { authProperties };
export default authProperties;
