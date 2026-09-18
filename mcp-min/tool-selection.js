/**
 * Which tools a server exposes, decided once at startup:
 *
 *   base     = tools of --profile                 (default: full)
 *   selected = (base ∪ --include-tools) − --exclude-tools
 *   exposed  = selected − tools the tools config disables
 *
 * Fixed for the life of the process and the same for both transports, as MCP requires; and
 * `pos-cli mcp-config` prints it from this code, so what it shows is what the server serves.
 *
 * Every mistake in the selection stops startup: a tool name that silently matches nothing looks
 * exactly like a selection that took effect.
 */
import defaultRegistry from './tools.js';
import { DEFAULT_PROFILE, PROFILE_NAMES, profileTools } from './profiles.js';
import { loadToolsConfig, isDisabledByConfig, configuredTool } from './tools-config.js';
import { ToolsConfigError } from './tools-config-error.js';

/**
 * The one lookup every dispatch path uses for a client-supplied name. A Map, so `constructor`,
 * `__proto__` and an unexposed tool all come back undefined.
 */
export function findTool(tools, name) {
  return typeof name === 'string' ? tools.get(name) : undefined;
}

const unique = names => [...new Set(names)];

function levenshtein(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

function unknownNamesMessage(flag, names, registeredNames) {
  const described = names.map((name) => {
    const close = registeredNames
      .map(candidate => ({ candidate, distance: levenshtein(name, candidate) }))
      .filter(({ distance }) => distance <= 2)
      .sort((x, y) => x.distance - y.distance)
      .slice(0, 3)
      .map(({ candidate }) => candidate);
    return close.length ? `${name} (did you mean ${close.join(' or ')}?)` : name;
  });
  return `${flag}: no such tool: ${described.join(', ')}`;
}

const listOrNone = names => (names.length ? names.join(', ') : '(none)');

/**
 * @param {ReadonlyMap<string, object>} options.registry - every registered tool, in client order
 * @returns {{ tools: Map<string, object>, profile: string, include: string[], exclude: string[],
 *   hidden: Array<{ name: string, reason: 'profile' | 'excluded' | 'disabled' }> }}
 * @throws {ToolsConfigError} for any selection that is not exactly what it looks like
 */
export function resolveTools({ registry, config, configPath, profile = DEFAULT_PROFILE, include = [], exclude = [] }) {
  const registeredNames = [...registry.keys()];
  const base = profileTools(profile, registeredNames);
  if (!base) {
    throw new ToolsConfigError(`--profile ${profile}: no such profile. Available profiles: ${PROFILE_NAMES.join(', ')}.`);
  }

  include = unique(include);
  exclude = unique(exclude);

  const unknown = [['--include-tools', include], ['--exclude-tools', exclude]]
    .map(([flag, names]) => [flag, names.filter(name => !registry.has(name))])
    .filter(([, names]) => names.length > 0);
  if (unknown.length > 0) {
    throw new ToolsConfigError(
      `${unknown.map(([flag, names]) => unknownNamesMessage(flag, names, registeredNames)).join('; ')}.`
    );
  }

  const both = include.filter(name => exclude.includes(name));
  if (both.length > 0) {
    throw new ToolsConfigError(
      `Named in both --include-tools and --exclude-tools: ${both.join(', ')}. Name each tool in only one of them.`
    );
  }

  // Including a tool the config switches off would do nothing, and nothing would say so.
  const disabledIncludes = include.filter(name => isDisabledByConfig(config, name));
  if (disabledIncludes.length > 0) {
    throw new ToolsConfigError(
      `--include-tools names tools disabled in the tools config at ${configPath}: ${disabledIncludes.join(', ')}. ` +
      'Enable them there, or remove them from --include-tools.'
    );
  }

  const inBase = new Set(base);
  const tools = new Map();
  const hidden = [];
  for (const [name, tool] of registry) {
    if (!inBase.has(name) && !include.includes(name)) hidden.push({ name, reason: 'profile' });
    else if (exclude.includes(name)) hidden.push({ name, reason: 'excluded' });
    else if (isDisabledByConfig(config, name)) hidden.push({ name, reason: 'disabled' });
    else tools.set(name, configuredTool(config, name, tool));
  }

  if (tools.size === 0) {
    throw new ToolsConfigError(
      `No tools to expose: profile ${profile} with --include-tools ${listOrNone(include)} and ` +
      `--exclude-tools ${listOrNone(exclude)} leaves none enabled. Choose another profile or name tools with --include-tools.`
    );
  }

  return { tools, profile, include, exclude, hidden };
}

/**
 * Loads the tools config and resolves the selection against it: what both bins call.
 * @throws {ToolsConfigError}
 */
export function selectTools({ profile, include, exclude, env = process.env, registry = defaultRegistry } = {}) {
  const { path, source, state, config } = loadToolsConfig(registry, { env });
  const selection = resolveTools({ registry, config, configPath: path, profile, include, exclude });
  return { ...selection, registered: registry.size, configFile: { path, source, state } };
}

/** The startup log line: enough to tell from a log file why a tool was or was not exposed. */
export function describeSelection({ tools, registered, profile, include, exclude }) {
  return `mcp-min: exposing ${tools.size} of ${registered} tools ` +
    `(profile ${profile}; --include-tools ${listOrNone(include)}; --exclude-tools ${listOrNone(exclude)})`;
}
