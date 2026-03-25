import Portal from '../portal.js';
import { findModuleVersion } from './dependencies.js';

/**
 * Creates a registry-aware getVersions function.
 *
 * Each module name is routed to its registry URL via registries[name] || defaultUrl.
 * Names sharing the same URL are batched into a single request, so the common case
 * (all modules on one registry) is still a single network call.
 *
 * @param {Function} fetch      Raw fetcher: async (names, url) => moduleVersionData[]
 * @param {string}   defaultUrl Fallback registry URL for unlisted modules.
 * @param {Object}   registries { moduleName: registryUrl } per-module overrides.
 */
const makeGetVersions = (fetch, defaultUrl, registries = {}) => async (names) => {
  const byUrl = new Map();
  for (const name of names) {
    const url = registries[name] || defaultUrl;
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push(name);
  }
  // allSettled so a single unreachable registry doesn't silently abort resolution of
  // modules on other registries. All failures are collected and reported together.
  const settled = await Promise.allSettled(
    [...byUrl.entries()].map(([url, moduleNames]) => fetch(moduleNames, url))
  );
  const failures = settled.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    const messages = failures.map(r => r.reason?.message ?? String(r.reason)).join('; ');
    throw new Error(`Registry fetch failed: ${messages}`);
  }
  return settled.flatMap(r => r.value);
};

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
    throw new Error(`Can't find module ${moduleName}${moduleVersion ? ` with version ${moduleVersion}` : ''} (registry: ${registryUrl})`);
  }
  return result;
};

/** Convenience: creates the standard registry fetcher wired to the Partner Portal. */
const createGetVersions = (repositoryUrl, registries = {}) =>
  makeGetVersions(Portal.moduleVersions.bind(Portal), repositoryUrl, registries);

export { makeGetVersions, createGetVersions, findVersionWithContext };
