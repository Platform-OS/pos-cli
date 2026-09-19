/**
 * The parameters every authenticating tool accepts, spread into each tool's schema so that all of
 * them document and validate credentials identically.
 *
 * `resolveAuth` (mcp-min/auth.js) takes `url` + `email` + `token` together, ahead of the `.pos`
 * lookup, so a tool closing its schema with `additionalProperties: false` has to declare all three
 * or it would reject the very callers that path exists to serve. The invariant is enforced by
 * `__tests__/validate-params.test.js`, which derives the tool list from the registry.
 *
 * `env` belongs here too. Declaring it per tool is how it ended up in three different wordings
 * with five tools describing it not at all, and how the fallback that decides which instance a
 * call without `env` reaches came to be stated on four tools out of twenty-four.
 *
 * Only `env` carries a description, and it says what the parameter is rather than what omitting it
 * does. The precedence in full — the three together, then this, then MPKIT_*, then the first entry
 * — is in the server instructions (mcp-min/instructions.js), sent once a session rather than with
 * every tool; and what omitting it costs is no longer a warning anyone has to remember, because
 * `resolveAuth` refuses the unnamed default for a call that can change an instance (TASK-31). It
 * used to read "the first entry if omitted", which is now true only of the tools that just read.
 */
const authProperties = {
  env: {
    type: 'string',
    description: 'Which environment in .pos to use.'
  },
  url: { type: 'string', format: 'uri' },
  email: { type: 'string', format: 'email' },
  token: { type: 'string' }
};

export { authProperties };
export default authProperties;
