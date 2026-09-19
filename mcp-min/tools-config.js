/**
 * The tools config (mcp-min/tools.config.json, or the file MCP_TOOLS_CONFIG names): the one place
 * it is read, validated and interpreted, so `pos-cli mcp-config` prints what the server applies.
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

// Tools an earlier release registered. A config naming one was written against a version that had
// it, which is not the typo the unknown-name rule exists to catch — there is nothing for such an
// entry to fail to switch off — and refusing to start would break an upgrade over a line the user
// could not have known to remove. Warned about and ignored instead.
export const REMOVED_TOOLS = new Map([
  ['check', 'removed in 7.0.0; use check-run'],
  ['deploy-status', 'removed in 7.0.0; use job-status with the job_id deploy-start returned'],
  ['deploy-wait', 'removed in 7.0.0; use job-status with wait_ms'],
  ['data-import-status', 'removed in 7.0.0; use job-status with the job_id data-import returned'],
  ['data-export-status', 'removed in 7.0.0; use job-status with the job_id data-export returned'],
  ['data-clean-status', 'removed in 7.0.0; use job-status with the job_id data-clean returned'],
  ['tests-run-async-result', 'removed in 7.0.0; use job-status with the job_id tests-run-async returned']
]);

export function toolsConfigLocation(env) {
  return env.MCP_TOOLS_CONFIG
    ? { path: env.MCP_TOOLS_CONFIG, source: 'MCP_TOOLS_CONFIG' }
    : { path: BUNDLED_CONFIG_PATH, source: 'bundled' };
}

/**
 * Reads and validates the tools config, failing closed: this file decides which tools are exposed,
 * so a config that is present but wrong stops the server rather than silently re-enabling every
 * tool the author meant to switch off. Only a file that is missing, unreadable or unparseable is
 * treated as absent, and `state` says which it was.
 *
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

  // The schema cannot enumerate tool names, so a typo like "deploy-strt" would be accepted, match
  // nothing, and leave "deploy-start" enabled while the config looks like it took effect.
  // Map#has, not `in`: `in` walks the prototype chain, so `toString` would pass as a known tool.
  const unknown = Object.keys(raw.tools).filter(name => !registry.has(name));
  const misnamed = unknown.filter(name => !REMOVED_TOOLS.has(name));
  if (misnamed.length > 0) {
    throw new ToolsConfigError(`Invalid tools config at ${location.path}: no such tool: ${misnamed.join(', ')}`);
  }
  for (const name of unknown) {
    log.warn(`mcp-min: tools config at ${location.path} configures ${name}, which no longer exists (${REMOVED_TOOLS.get(name)}); ignoring it`);
  }

  log.debug('tools config loaded', { path: location.path, tools: Object.keys(raw.tools).length });
  return { ...location, state: 'loaded', config: raw };
}

// Own entries only: a lookup by a name that was never checked against the registry (a tool name
// from a flag) must not land on Object.prototype.
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
