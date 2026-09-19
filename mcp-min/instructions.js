/**
 * The server-level `instructions` string, built from the tools a server actually exposes.
 *
 * MCP returns this once, at `initialize` and at `server/discover`, and clients generally place it
 * in the model's system prompt. It is the only place that can hold a rule spanning several tools;
 * a tool's own description holds everything about that tool.
 *
 * Two rules keep it honest:
 *
 * 1. It never names a tool the server does not expose. Guidance is assembled from the exposed Map
 *    (`selectTools().tools`) rather than from a list kept in step by hand, and `only(...)` drops
 *    the names that are not there. Naming a tool a client cannot call invites the model to try it
 *    and teaches it that this server's guidance is unreliable.
 * 2. It does not repeat a tool description. Everything here is a fact no single tool owns — how
 *    credentials resolve, what every result looks like, what relative paths are relative to — so
 *    the per-request cost of `tools/list` is not paid twice.
 *
 * It describes this server only. What else a client has registered is not knowable here and not
 * this server's business.
 */

/** The exposed names among `names`, in the order given; `[]` when none of them are exposed. */
const only = (tools, names) => names.filter(name => tools.has(name));

const list = (names) => (names.length < 2
  ? names.join('')
  : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/**
 * Each section returns its text, or null when the tools it is about are not exposed.
 *
 * A section that names tools derives those names from `tools`, so there is no second list to keep
 * in step: `__tests__/instructions.test.js` reads the output back and fails on any registered name
 * that is not exposed, whatever produced it.
 */
const SECTIONS = [
  // resolveAuth (mcp-min/auth.js) resolves credentials four ways, and this states one of them.
  // The other three are not the model's to act on: it cannot set MPKIT_* variables, it passes
  // url+email+token when it has been given them, and the first-entry fallback is a consequence
  // rather than a choice. Publishing the precedence spent bytes teaching a resolution order that
  // the server performs and the model cannot influence — what it can act on is "name env, and
  // above all when writing", which is also on the parameter itself, where the argument is filled
  // in. Stated only when an exposed tool actually authenticates.
  (tools) => ([...tools.values()].some(tool => tool.inputSchema?.properties?.env)
    ? 'Credentials: name the instance with env. Omit it and a call that only reads uses the first .pos entry, '
      + 'while a call that could change an instance is refused and the error lists the environments to choose '
      + 'from. An env that is not in .pos is an error, never a fall back to another instance.'
    : null),

  // `runTool` builds every result, so this can be stated plainly. It used to hedge — "usually as
  // ok:false" — because the migrations tools answered `{ status }` and their failures reached
  // clients as successful calls.
  () => 'Results: every tool answers with ok. A failure is ok:false with an error carrying a kind and a code; '
    + 'the kind says what to do next — input: fix the arguments; not_found: what you named is not there; '
    + 'auth: re-authenticate, do not retry; instance: the instance refused it, so read the message rather than '
    + 'retrying unchanged; unavailable: the same call may work later. A call that answered is not a call that worked.',

  // Tools resolve relative paths through the process working directory, which `pos-cli-mcp --cwd`
  // sets at startup. True of every tool that takes one, so it names none of them: the schemas
  // already say which arguments are paths.
  () => 'Paths: a relative path in any argument resolves against the directory this server was started in.',

  // Each starter's description already says it returns a job_id. What no single one of them can
  // say is which calls share the pattern, or that waiting is done with wait_ms rather than a loop.
  (tools) => {
    const starters = only(tools, ['deploy-start', 'data-import', 'data-export', 'data-clean', 'tests-run-async']);
    if (!tools.has('job-status') || starters.length === 0) return null;
    return `Long operations: ${list(starters)} ${starters.length === 1 ? 'answers' : 'answer'} before the work is done, `
      + 'returning a job_id. Give it back to job-status exactly as received, and use wait_ms to wait for the result '
      + 'instead of polling in a loop.';
  }
];

/**
 * @param {ReadonlyMap<string, object>} tools - the exposed tools
 * @returns {string} the instructions, or '' when no section applies. The SDK omits the field
 *   entirely for an empty string, which is the right answer for a server with nothing to say.
 */
export function buildInstructions(tools) {
  if (!(tools instanceof Map)) throw new TypeError('buildInstructions: tools must be the Map of exposed tools');
  return SECTIONS.map(section => section(tools)).filter(Boolean).join('\n\n');
}

export default buildInstructions;
