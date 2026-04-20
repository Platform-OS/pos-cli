import semver from 'semver';
import { readConfig, writePosModules, getRegistryUrl } from './configFiles.js';
import { parseAndValidateModuleArg } from './parseModuleArg.js';
import { createGetVersions, findVersionWithContext } from './registry.js';
import { resolveAndDownload } from './orchestrator.js';

// Updates a single module entry. Unlike addNewModule, update is unconditional when a version is given.
//
// Version storage rules:
//   - No version, existing entry is range → range stays in pos-module.json (no-op on manifest)
//   - No version, existing entry is exact → updates to latest stable
//   - Explicit range                      → stores the new range (after validating it resolves)
//   - Explicit exact version              → stores the exact version
const updateModule = async (moduleName, moduleVersion, localModules, getVersions, registryUrl) => {
  if (!moduleVersion) {
    const current = localModules[moduleName];
    if (current && semver.validRange(current) && !semver.valid(current)) {
      // Range entry: leave unchanged; resolveDependencies will resolve it in the lock file.
      return localModules;
    }
    const newModule = await findVersionWithContext(moduleName, undefined, getVersions, registryUrl);
    return { ...localModules, ...newModule };
  }

  await findVersionWithContext(moduleName, moduleVersion, getVersions, registryUrl);
  return { ...localModules, [moduleName]: moduleVersion };
};

/**
 * High-level update operation: updates a named module (or all modules) in pos-module.json,
 * re-resolves the full dependency tree, updates the lock file, and downloads changed modules.
 *
 * @param {ora.Ora} spinner
 * @param {string|undefined} moduleNameWithVersion  e.g. "core@2.0.0" or "core" or undefined (update all)
 * @param {Object} options
 * @param {boolean} [options.dev=false]  Target devDependencies section (or include dev when updating all).
 */
const updateModules = async (spinner, moduleNameWithVersion, { dev = false } = {}) => {
  let { dependencies: prodModules, devDependencies: devModules, registries } = readConfig();
  const registryUrl = getRegistryUrl();
  const getVersions = createGetVersions(registryUrl, registries);

  if (moduleNameWithVersion) {
    const [moduleName, moduleVersion] = parseAndValidateModuleArg(moduleNameWithVersion);
    const targetSection = dev ? devModules : prodModules;

    if (!(moduleName in targetSection)) {
      const otherFlag = dev ? 'omit --dev' : 'use --dev';
      throw new Error(`Module "${moduleName}" is not in ${dev ? 'devDependencies' : 'dependencies'}. Did you mean to ${otherFlag}?`);
    }

    const updated = await updateModule(moduleName, moduleVersion, targetSection, getVersions, registryUrl);
    const manifestChanged = updated !== targetSection;
    if (dev) devModules = updated; else prodModules = updated;

    const { resolvedProd, resolvedDev } = await resolveAndDownload(spinner, prodModules, devModules, registryUrl, getVersions, { registries, includeDev: dev });
    if (manifestChanged) writePosModules(prodModules, devModules);
    const resolvedVersion = resolvedProd[moduleName] ?? resolvedDev[moduleName]
      ?? (dev ? devModules : prodModules)[moduleName];
    spinner.succeed(`Updated module: ${moduleName}@${resolvedVersion}`);
  } else {
    const allEmpty = Object.keys(prodModules).length === 0 &&
      (!dev || Object.keys(devModules).length === 0);
    if (allEmpty) {
      spinner.warn('No modules to update');
      return;
    }
    await resolveAndDownload(spinner, prodModules, devModules, registryUrl, getVersions, { registries, includeDev: dev });
    spinner.succeed('Updated all modules to latest versions');
  }
};

export { updateModule, updateModules };
