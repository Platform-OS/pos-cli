import fs from 'fs';

import logger from './logger.js';
import files from './files.js';
import dir from './directories.js';
import { moduleConfigFileName, moduleManifestFileName } from './modules.js';

// Fields in pos-module.json that are structural metadata, not template substitution values.
// Returning these as mustache context would corrupt templates: object values render as
// "[object Object]" when interpolated, and mustache also treats objects as sections.
const POS_MODULE_STRUCTURAL_KEYS = new Set(['dependencies', 'devDependencies', 'registries']);

// Strips structural pos-module.json fields so only scalar substitution values remain.
// Preserves name, machine_name, version, repository_url, and any custom scalar fields.
const extractTemplateValues = (manifest) =>
  Object.fromEntries(
    Object.entries(manifest).filter(([k]) => !POS_MODULE_STRUCTURAL_KEYS.has(k))
  );

// Loads the pos-module.json scalar values for a module directory (or root for dev workflow).
// Returns {} when no pos-module.json is found.
const posModuleScalars = (module) => {
  const modManifestPath = `${dir.MODULES}/${module}/${moduleManifestFileName}`;
  if (fs.existsSync(modManifestPath)) {
    return extractTemplateValues(files.readJSON(modManifestPath, { exit: false }) || {});
  }

  // Module repo development: root pos-module.json when machine_name matches.
  if (fs.existsSync(moduleManifestFileName)) {
    const rootManifest = files.readJSON(moduleManifestFileName, { exit: false }) || {};
    if (rootManifest.machine_name === module) return extractTemplateValues(rootManifest);
  }

  return {};
};

const loadSettingsFileForModule = module => {
  // Base: scalar fields from pos-module.json (machine_name, version, name, …).
  // These are module metadata that templates can reference without duplication.
  const base = posModuleScalars(module);

  // Overlay: template-values.json adds installation-specific parameters and can override
  // the base values. Consuming apps only need to specify what differs from the manifest.
  const templatePath = `${dir.MODULES}/${module}/${moduleConfigFileName}`;
  if (fs.existsSync(templatePath)) {
    const overlay = files.readJSON(templatePath, { exit: false }) || {};
    return { ...base, ...overlay };
  }

  return base;
};

const fetchSettings = async (environment, { exit = true } = {}) => {
  const settings = settingsFromEnv() || settingsFromDotPos(environment);
  if (settings) return settings;

  // Long-lived callers (e.g. the MCP server) pass { exit: false } so an
  // unresolved environment is a recoverable miss they can turn into a caught
  // error — never a process.exit that would tear down the whole server. CLI
  // callers keep the default exit:true for the usual "print message and die".
  if (!exit) return null;

  if (environment) {
    await logger.Error(`No settings for ${environment} environment, please see pos-cli env add`);
  } else {
    await logger.Error('No environment specified, please pass environment for a command `pos-cli <command> [environment]`');
  }

  // Ensure process exits (logger.Error should exit, but this is a safeguard)
  process.exit(1);
};

const settingsFromEnv = () => {
  const { MPKIT_URL: url, MPKIT_EMAIL: email, MPKIT_TOKEN: token } = process.env;
  if (url && token && email) {
    return { url, email, token };
  }
};

const settingsFromDotPos = (env) => files.getConfig()[env];

export { fetchSettings, loadSettingsFileForModule, settingsFromDotPos };
