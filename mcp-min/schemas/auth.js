/**
 * The parameters every authenticating tool accepts, spread into each tool's schema so that all of
 * them document and validate credentials identically.
 *
 * `resolveAuth` (mcp-min/auth.js) takes `url` + `email` + `token` together, ahead of the `.pos`
 * lookup, so a tool closing its schema with `additionalProperties: false` has to declare all three
 * or it would reject the very callers that path exists to serve. The invariant is enforced by
 * `__tests__/validate-params.test.js`, which derives the tool list from the registry.
 *
 * `env` belongs here too: declaring it per tool is how it ended up in three different wordings with
 * five tools describing it not at all. It says what the parameter is rather than what omitting it
 * does, because `resolveAuth` refuses the unnamed default for a call that can change an instance
 * (TASK-31).
 *
 * **Every byte here is paid by each of the twenty-one tools that spread it, on every request**:
 * these three sentences are 3,420 bytes of the bare `tools/list` and 1,524 of `--profile dev`
 * (measured, TASK-45). So the full precedence lives in the server instructions, which are sent
 * once; what stays is only what is read while the argument is being filled in — that the three go
 * together, and that they are used instead of `env`. Publishing them undescribed was the wrong
 * economy on nineteen tools, one of which deploys.
 *
 * The grouping is prose, not `dependentRequired`: that expresses it exactly and compiles, but it is
 * a sibling of `properties`, so it cannot travel inside this object and would have to be spread
 * into twenty-one schemas by hand — the drift `authProperties` exists to prevent. It also
 * duplicates `resolveAuth`, which answers an incomplete set with `INCOMPLETE_CREDENTIALS` naming
 * what is missing.
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
