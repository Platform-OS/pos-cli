import semver from 'semver';
import Portal from '../portal.js';
import logger from '../logger.js';
import { getRegistryUrl } from './configFiles.js';
import { printPostInstallMessages } from './postInstall.js';

const showModuleVersions = async (spinner, moduleName) => {
  const registryUrl = getRegistryUrl();

  spinner.start(`Fetching versions for ${moduleName}...`);

  let results;
  try {
    results = await Portal.moduleVersions([moduleName], registryUrl);
  } catch (e) {
    throw new Error(`Failed to fetch versions for "${moduleName}" from ${registryUrl}: ${e.message}`);
  }

  const moduleEntry = results.find(m => m.module === moduleName);
  if (!moduleEntry) {
    throw new Error(`Module "${moduleName}" not found in the registry (${registryUrl})`);
  }

  const versions = Object.keys(moduleEntry.versions);
  if (versions.length === 0) {
    spinner.warn(`Module "${moduleName}" has no published versions`);
    return;
  }

  const sorted = versions.sort((a, b) => semver.rcompare(a, b));
  spinner.succeed(`${moduleName} — ${sorted.length} version(s):`);
  for (const v of sorted) {
    logger.Info(`  ${v}`, { hideTimestamp: true });
  }

  // Re-show the module's post-install instructions when it is installed locally,
  // so users can recover guidance they scrolled past at install time (cf. `brew info`).
  printPostInstallMessages([moduleName]);
};

export { showModuleVersions };
