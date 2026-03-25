import fs from 'fs';
import path from 'path';
import { readConfig, writePosModules, writePosModulesLock, getRegistryUrl } from './configFiles.js';
import { createGetVersions } from './registry.js';
import { resolveAndDownload } from './orchestrator.js';
import { POS_MODULE_FILE } from './paths.js';

const getModulesDir = () => path.join(process.cwd(), 'modules');
const getModulePath = (name) => path.join(getModulesDir(), name);

/**
 * Removes a module from pos-module.json, deletes its directory from disk,
 * and re-resolves remaining dependencies to update the lock file.
 *
 * @param {ora.Ora} spinner
 * @param {string}  moduleName  Module to uninstall (e.g. "core").
 * @param {Object}  options
 * @param {boolean} [options.dev=false]  Target devDependencies section.
 */
const uninstallModule = async (spinner, moduleName, { dev = false } = {}) => {
  let { dependencies: prodModules, devDependencies: devModules, registries } = readConfig();
  const registryUrl = getRegistryUrl();

  const inProd = moduleName in prodModules;
  const inDev = moduleName in devModules;

  if (!inProd && !inDev) {
    throw new Error(`Module "${moduleName}" is not installed`);
  }

  if (dev && !inDev) {
    const hint = inProd ? `. Omit --dev to uninstall it from dependencies.` : '';
    throw new Error(`Module "${moduleName}" is not in devDependencies${hint}`);
  }

  if (!dev && !inProd) {
    const hint = inDev ? `. Use --dev to uninstall it from devDependencies.` : '';
    throw new Error(`Module "${moduleName}" is not in dependencies${hint}`);
  }

  // Remove from the appropriate section
  if (dev) {
    const { [moduleName]: _removed, ...rest } = devModules;
    devModules = rest;
  } else {
    const { [moduleName]: _removed, ...rest } = prodModules;
    prodModules = rest;
  }

  // Write updated manifest before touching disk — manifest is the source of truth
  writePosModules(prodModules, devModules);

  // Remove module directory from disk
  const modulePath = getModulePath(moduleName);
  await fs.promises.rm(modulePath, { recursive: true, force: true });

  // Re-resolve remaining deps to update the lock file
  const hasProd = Object.keys(prodModules).length > 0;
  const hasDev = Object.keys(devModules).length > 0;

  if (hasProd || hasDev) {
    const includeDev = dev && hasDev;
    const getVersions = createGetVersions(registryUrl, registries);
    await resolveAndDownload(spinner, prodModules, devModules, registryUrl, getVersions, { registries, includeDev });
  } else {
    writePosModulesLock({}, {}, {});
  }

  const section = dev ? 'devDependencies' : 'dependencies';
  spinner.succeed(`Uninstalled module: ${moduleName} from ${section} in ${POS_MODULE_FILE}`);
};

export { uninstallModule };
