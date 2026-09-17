/**
 * The tools config (mcp-min/tools.config.json, or the file MCP_TOOLS_CONFIG names): the one
 * place it is read, validated and interpreted.
 *
 * Both the server and `pos-cli mcp-config` go through this module, so the configuration the
 * one prints is the configuration the other applies — they used to read the file separately,
 * and had already drifted apart on validation.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { validate } from '../lib/validation/index.js';
import { ToolsConfigError } from './tools-config-error.js';
import log from './log.js';

const here = dirname(fileURLToPath(import.meta.url));

export const BUNDLED_CONFIG_PATH = join(here, 'tools.config.json');

const configSchema = JSON.parse(readFileSync(join(here, 'tools.config.schema.json'), 'utf-8'));

/**
 * @param {Record<string, string|undefined>} env
 * @returns {{ path: string, source: 'MCP_TOOLS_CONFIG' | 'bundled' }}
 */
export function toolsConfigLocation(env) {
  return env.MCP_TOOLS_CONFIG
    ? { path: env.MCP_TOOLS_CONFIG, source: 'MCP_TOOLS_CONFIG' }
    : { path: BUNDLED_CONFIG_PATH, source: 'bundled' };
}

/**
 * Reads and validates the tools config.
 *
 * Fails closed on anything it can detect: this file decides which tools are exposed, so a
 * config that is present but wrong must stop the server rather than be ignored, which would
 * silently re-enable every tool the author meant to switch off. A file that is missing or
 * cannot be read or parsed is the one case treated as absent — defaults apply — and `state`
 * says which it was, so `pos-cli mcp-config` can show it.
 *
 * @param {ReadonlyMap<string, object>} registry - every registered tool; config entries must name one
 * @param {object} [options]
 * @param {Record<string, string|undefined>} [options.env]
 * @returns {{ path: string, source: 'MCP_TOOLS_CONFIG' | 'bundled',
 *   state: 'loaded' | 'missing' | 'unreadable' | 'unparseable', config: { tools: object } }}
 * @throws {ToolsConfigError} when the file is present but does not describe a valid config
 */
export function loadToolsConfig(registry, { env = process.env } = {}) {
  const location = toolsConfigLocation(env);
  const defaults = state => {
    const level = location.source === 'MCP_TOOLS_CONFIG' ? 'warn' : 'debug';
    log[level](`mcp-min: tools config ${location.path} is ${state}; using defaults`);
    return { ...location, state, config: { tools: {} } };
  };

  let text;
  try {
    text = readFileSync(location.path, 'utf-8');
  } catch (err) {
    return defaults(err.code === 'ENOENT' ? 'missing' : 'unreadable');
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return defaults('unparseable');
  }

  const result = validate(configSchema, raw);
  if (!result.valid) {
    throw new ToolsConfigError(`Invalid tools config at ${location.path}: ${result.message}`);
  }

  // The schema constrains the shape of each entry but cannot enumerate tool names, so a
  // typo like "deploy-strt" would otherwise be accepted, match nothing, and leave
  // "deploy-start" enabled — the exact fail-open the schema check exists to prevent, and the
  // harder one to notice because the config looks like it took effect. Map#has, not `in`:
  // `in` walks the prototype chain, so an entry keyed `toString` would pass as a known tool.
  const unknown = Object.keys(raw.tools).filter(name => !registry.has(name));
  if (unknown.length > 0) {
    throw new ToolsConfigError(`Invalid tools config at ${location.path}: no such tool: ${unknown.join(', ')}`);
  }

  log.debug('tools config loaded', { path: location.path, tools: Object.keys(raw.tools).length });
  return { ...location, state: 'loaded', config: raw };
}

// Own entries only: every key was checked against the registry, but a lookup by a name that
// was not (a tool name coming from a flag) must still not land on Object.prototype.
const entryFor = (config, name) => (Object.hasOwn(config.tools, name) ? config.tools[name] : undefined);

/** The one definition of "the tools config switches this tool off". */
export function isDisabledByConfig(config, name) {
  return entryFor(config, name)?.enabled === false;
}

/** The tool as the config presents it: its description replaced when the config gives one. */
export function configuredTool(config, name, tool) {
  const description = entryFor(config, name)?.description;
  return description ? { ...tool, description } : tool;
}
