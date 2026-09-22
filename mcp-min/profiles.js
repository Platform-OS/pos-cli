/**
 * Named starting sets for `--profile`. Kept free of imports so the argument parser can list them
 * without loading the tool registry; the order clients see is always registry order.
 */

export const DEFAULT_PROFILE = 'full';

// The tools a coding agent uses in its edit → check → deploy → verify loop. A tool added to
// the registry is not in here until someone decides it belongs.
const DEV_TOOLS = Object.freeze([
  'check-run',
  'logs-fetch',
  'liquid-exec',
  'graphql-exec',
  // The verify half of the loop: the only check that covers routing, the layout and the policies
  // between the source and the URL.
  'page-fetch',
  'envs-list',
  'deploy-start',
  // With deploy-start and not this, an agent in the dev loop can only learn what a
  // non-partial deploy deletes by deploying. deploy-start's description names it, too.
  'deploy-dry-run',
  'unit-tests-run',
  // The only way to read back anything a starter began; the six per-operation status tools it
  // replaced are gone (6.6.0).
  'job-status'
]);

// A Map so that a profile name from the command line (`constructor`, `__proto__`…) can only
// match a profile defined here.
const PROFILES = new Map([
  // Computed, so a new tool reaches `full` without an edit here.
  ['full', { summary: 'every tool (the default)', tools: registered => [...registered] }],
  ['dev', { summary: DEV_TOOLS.join(', '), tools: () => [...DEV_TOOLS] }],
  // Empty, so that `--profile none --include-tools a,b` is a pure allowlist.
  ['none', { summary: 'no tools; name them with --include-tools', tools: () => [] }]
]);

export const PROFILE_NAMES = Object.freeze([...PROFILES.keys()]);

/** Each profile with a one-line summary, for --help. */
export function describeProfiles() {
  return [...PROFILES].map(([name, { summary }]) => ({ name, summary }));
}

/** The names a profile starts from, or undefined when there is no such profile. */
export function profileTools(name, registeredNames) {
  return PROFILES.get(name)?.tools(registeredNames);
}
