import { readConfig, writePosModules, getRegistryUrl } from './configFiles.js';
import { POS_MODULE_FILE } from './paths.js';
import { parseAndValidateModuleArg } from './parseModuleArg.js';
import { createGetVersions, findVersionWithContext } from './registry.js';
import { resolveAndDownload, frozenInstall, smartInstall } from './orchestrator.js';
import { printPostInstallMessages } from './postInstall.js';

// Returns the updated modules map, or null when the module is already installed
// and no explicit version was requested (install is conditional, unlike update).
//
// Version storage rules:
//   - No version, new module      → stores "^resolved.version" (caret on the resolved version)
//   - Explicit range              → stores the range as-is (after validating it resolves)
//   - Explicit exact version      → stores the exact version
//   - No version, already present → no-op (returns null; existing range/pin is preserved)
const addNewModule = async (moduleName, moduleVersion, localModules, getVersions, registryUrl) => {
  if (!moduleVersion && localModules[moduleName]) return null;

  if (!moduleVersion) {
    const newModule = await findVersionWithContext(moduleName, undefined, getVersions, registryUrl);
    return { ...localModules, [moduleName]: `^${newModule[moduleName]}` };
  }

  await findVersionWithContext(moduleName, moduleVersion, getVersions, registryUrl);
  return { ...localModules, [moduleName]: moduleVersion };
};

/**
 * High-level install operation: optionally adds a new module to pos-module.json,
 * resolves the full dependency tree, updates the lock file, and downloads modules.
 *
 * @param {ora.Ora} spinner
 * @param {string|undefined} moduleNameWithVersion  e.g. "core@2.0.0" or "core" or undefined
 * @param {Object} options
 * @param {boolean} [options.dev=false]    Target devDependencies section.
 * @param {boolean} [options.frozen=false] CI mode: use lock file as-is.
 */
const installModules = async (spinner, moduleNameWithVersion, { dev = false, frozen = false } = {}) => {
  const { dependencies: prodModules, devDependencies: devModules, registries } = readConfig();
  const registryUrl = getRegistryUrl();

  if (frozen) {
    if (moduleNameWithVersion) throw new Error('Cannot add a new module with --frozen');
    // Returns early: --frozen (CI) installs intentionally print no post-install messages.
    return frozenInstall(spinner, prodModules, devModules, registryUrl, { includeDev: dev });
  }

  let prodMods = prodModules;
  let devMods = devModules;
  const getVersions = createGetVersions(registryUrl, registries);
  let added = null;
  let explicitName = null;

  if (moduleNameWithVersion) {
    const [moduleName, moduleVersion] = parseAndValidateModuleArg(moduleNameWithVersion);
    explicitName = moduleName;
    const targetSection = dev ? devMods : prodMods;
    const updated = await addNewModule(moduleName, moduleVersion, targetSection, getVersions, registryUrl);
    if (updated) {
      if (dev) devMods = updated; else prodMods = updated;
      added = moduleName;
    }
  }

  const allModules = dev ? { ...prodMods, ...devMods } : prodMods;
  if (Object.keys(allModules).length === 0) {
    const hint = !dev && Object.keys(devMods).length > 0 ? ' (use --dev to install devDependencies)' : '';
    spinner.warn(`Nothing to install${hint}`);
    return;
  }

  let result;
  if (moduleNameWithVersion) {
    // An explicit module name was given: always re-resolve. The manifest may have just
    // changed (added === moduleName) or the user is forcing a re-resolution of an already
    // present module — either way the lock cannot be trusted as authoritative.
    const newlyAdded = added ? new Set([added]) : new Set();
    result = await resolveAndDownload(spinner, prodMods, devMods, registryUrl, getVersions, { registries, includeDev: dev, newlyAdded });
  } else {
    // No-arg install: use the lock file when it is valid, fall back to full resolution
    // only when the lock is absent or stale. Matches Bundler / npm install semantics.
    result = await smartInstall(spinner, prodMods, devMods, registryUrl, getVersions, { registries, includeDev: dev });
  }

  // Write the manifest only after successful resolution so pos-module.json is never
  // updated when the install fails (e.g. due to a dependency conflict). This matches
  // npm's behaviour: package.json is only written when the install succeeds.
  if (added) {
    writePosModules(prodMods, devMods);
    const section = dev ? 'devDependencies' : 'dependencies';
    const version = dev ? devMods[added] : prodMods[added];
    spinner.start();
    spinner.succeed(`Added module: ${added}@${version} to ${section} in ${POS_MODULE_FILE}`);
  }

  // Print any declarative post-install instructions the installed modules ship.
  // Shown for modules actually downloaded this run (incl. transitive deps installed
  // for the first time), plus the explicitly named module even when already present —
  // matching `gem install` re-showing post_install_message on an explicit install.
  const toNotify = [explicitName, ...(result?.downloaded || [])].filter(Boolean);
  printPostInstallMessages(toNotify);
};

export { addNewModule, installModules };
