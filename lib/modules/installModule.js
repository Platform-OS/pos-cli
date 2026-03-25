import { findModuleVersion, resolveDependencies } from './dependencies.js';
import { readPosModulesLock, writePosModulesLock, posModulesLockFilePath } from './configFiles.js';
import { downloadAllModules, modulesToDownload } from './downloadModule.js';
import { formatModulesDiff } from './formatModulesDiff.js';

// Wraps findModuleVersion to surface a consistent error message that includes
// which registry was queried, making it easier to diagnose wrong-registry issues.
const findVersionWithContext = async (moduleName, moduleVersion, getVersions, registryUrl) => {
  let result;
  try {
    result = await findModuleVersion(moduleName, moduleVersion, getVersions);
  } catch (e) {
    throw new Error(`${e.message} (registry: ${registryUrl})`);
  }
  if (!result) {
    const versionClause = moduleVersion ? ` with version ${moduleVersion}` : '';
    throw new Error(`Can't find module ${moduleName}${versionClause} (registry: ${registryUrl})`);
  }
  return result;
};

// Returns the updated modules map, or null when the module is already installed
// and no explicit version was requested (install is conditional, unlike update).
const addNewModule = async (moduleName, moduleVersion, localModules, getVersions, registryUrl) => {
  if (!moduleVersion && localModules[moduleName]) return null;
  const newModule = await findVersionWithContext(moduleName, moduleVersion, getVersions, registryUrl);
  return { ...localModules, ...newModule };
};

// Always replaces the module version in the map (update is unconditional).
const updateModule = async (moduleName, moduleVersion, localModules, getVersions, registryUrl) => {
  const newModule = await findVersionWithContext(moduleName, moduleVersion, getVersions, registryUrl);
  return { ...localModules, ...newModule };
};

// Updates every root module to its latest stable version.
const updateAllModules = async (localModules, getVersions, registryUrl) => {
  const updated = { ...localModules };
  for (const moduleName of Object.keys(localModules)) {
    const newModule = await findVersionWithContext(moduleName, undefined, getVersions, registryUrl);
    Object.assign(updated, newModule);
  }
  return updated;
};

// Resolves dependencies, updates the lock file, downloads changed modules, and prints a diff.
const resolveAndDownload = async (spinner, localModules, repositoryUrl, getVersions) => {
  spinner.start('Resolving module dependencies');
  const previousLock = readPosModulesLock();
  const modulesLocked = await resolveDependencies(localModules, getVersions);
  writePosModulesLock(modulesLocked, repositoryUrl);
  spinner.succeed(`Modules lock file updated: ${posModulesLockFilePath}`);

  const toDownload = modulesToDownload(modulesLocked, previousLock);
  const skipCount = Object.keys(modulesLocked).length - Object.keys(toDownload).length;
  const skipNote = skipCount > 0 ? ` (${skipCount} already up-to-date)` : '';
  spinner.start('Downloading modules');
  await downloadAllModules(toDownload, repositoryUrl);
  spinner.succeed(`Modules downloaded successfully${skipNote}`);

  const diffLines = formatModulesDiff(previousLock, modulesLocked);
  if (diffLines.length > 0) process.stdout.write(diffLines.join('\n') + '\n');
};

export { addNewModule, updateModule, updateAllModules, resolveAndDownload };
