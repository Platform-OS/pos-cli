import semver from 'semver';
import logger from '../logger.js';

/**
 * Wraps getVersions to cache registry responses within a single resolution run.
 * Each module's data is fetched at most once, regardless of how many times it's needed.
 */
const withCache = (getVersions) => {
  const cache = new Map();
  return async (names) => {
    const uncached = names.filter(n => !cache.has(n));
    if (uncached.length > 0) {
      const results = await getVersions(uncached);
      for (const entry of results) cache.set(entry.module, entry);
    }
    return names.map(n => cache.get(n)).filter(Boolean);
  };
};

/**
 * Removes every constraint entry whose `requiredBy` matches the given key.
 *
 * Called when a module is downgraded to a different version: the constraints
 * that the old version contributed are no longer valid and must not pollute
 * resolution of transitive deps. Without this cleanup, a dep shared between
 * the old and new version (with different range requirements) may end up with
 * two mutually exclusive constraints → false "no satisfying version" error.
 */
const removeConstraintsFrom = (constraints, requiredBy) => {
  for (const list of constraints.values()) {
    let i = list.length;
    while (i--) {
      if (list[i].requiredBy === requiredBy) list.splice(i, 1);
    }
  }
};

/**
 * Extracts the module name from a "name@version" requiredBy key.
 * Uses lastIndexOf to handle the unlikely case of a name that contains '@'.
 */
const moduleNameFrom = (requiredBy) => requiredBy.slice(0, requiredBy.lastIndexOf('@'));

/**
 * Returns the highest available version satisfying all constraints simultaneously.
 *
 * When pinnedVersion is provided (the dep appears in root pos-modules.json) it is
 * validated against all constraints rather than auto-resolved — the user owns that pin.
 *
 * rootModuleNames is used only for error attribution: constraints coming from root
 * modules are annotated and a hint is appended when multiple root modules conflict.
 *
 * Note: pre-release versions are excluded from range matching by the semver library
 * unless the range itself contains a pre-release tag (standard npm behaviour).
 */
const pickBestVersion = (depName, allConstraints, versionsAvailable, pinnedVersion, rootModuleNames = new Set()) => {
  if (versionsAvailable.length === 0) {
    throw new Error(`Module "${depName}" has no published versions`);
  }

  if (pinnedVersion) {
    const conflicts = allConstraints.filter(({ constraint }) => !semver.satisfies(pinnedVersion, constraint));
    if (conflicts.length > 0) {
      const detail = conflicts
        .map(({ constraint, requiredBy }) => `${constraint} (required by ${requiredBy})`)
        .join(', ');
      throw new Error(
        `Version conflict: "${depName}@${pinnedVersion}" does not satisfy: ${detail}. ` +
        `Update "${depName}" in pos-modules.json to a compatible version.`
      );
    }
    return pinnedVersion;
  }

  const constraintList = allConstraints.map(({ constraint }) => constraint);
  const best = versionsAvailable
    .filter(v => constraintList.every(c => semver.satisfies(v, c)))
    .sort(semver.compare)
    .at(-1);

  if (!best) {
    const detail = allConstraints
      .map(({ constraint, requiredBy }) => {
        const isRoot = rootModuleNames.has(moduleNameFrom(requiredBy));
        return `${constraint} (required by ${requiredBy}${isRoot ? ', root module' : ''})`;
      })
      .join(', ');

    const rootsInvolved = [...new Set(
      allConstraints
        .map(({ requiredBy }) => moduleNameFrom(requiredBy))
        .filter(name => rootModuleNames.has(name))
    )];
    const hint = rootsInvolved.length >= 2
      ? ` Conflicting root modules: ${rootsInvolved.join(', ')}. Try updating them one at a time.`
      : '';

    throw new Error(`No version of "${depName}" satisfies all constraints: ${detail}.${hint}`);
  }

  return best;
};

/**
 * Resolves the full flat dependency tree using BFS with a global constraint map.
 *
 * Key properties:
 * - All constraints from all tree levels are accumulated before a version is chosen,
 *   so conflicts between requirements at different depths are always detected.
 * - When a new constraint forces a dep to a lower version, stale constraints from
 *   the old version are purged to prevent false conflicts with the new version's deps.
 * - Stale cleanup and version picking are separated into distinct passes so the
 *   iteration order of deps within a BFS round never affects correctness.
 * - A post-BFS reachability walk over the final version graph removes phantom deps:
 *   modules that were tentatively resolved but are unreachable from root because the
 *   version that required them was later downgraded away.
 * - Registry data is fetched at most once per module (memoised via withCache).
 * - Because constraints only accumulate (never relax), version picks are monotonically
 *   non-increasing — the algorithm is guaranteed to converge.
 *
 * @param {Object}   rootModules  - { name: exactVersion } from pos-modules.json
 * @param {Function} getVersions  - async (names[]) => moduleVersionData[]
 */
const resolveDependencies = async (rootModules, getVersions) => {
  if (Object.keys(rootModules).length === 0) return {};

  const fetch = withCache(getVersions);
  const resolved = { ...rootModules };  // name → exact version (refined as tree is walked)
  const constraints = new Map();        // name → [{ constraint, requiredBy }]
  const visited = new Set();            // "name@version" whose deps have been collected
  const rootModuleNames = new Set(Object.keys(rootModules));

  let queue = Object.entries(rootModules);

  while (queue.length > 0) {
    const names = [...new Set(queue.map(([name]) => name))];
    const versionData = await fetch(names);
    logger.Debug(`modulesVersions: ${JSON.stringify(versionData)}`);
    const versionMap = new Map(versionData.map(m => [m.module, m]));

    // Phase 1: walk every module in this batch and collect their dependency constraints
    const newDeps = new Set();

    for (const [name, version] of queue) {
      const key = `${name}@${version}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const moduleEntry = versionMap.get(name);
      if (!moduleEntry) throw new Error(`Module "${name}" not found in the registry`);

      const versionEntry = moduleEntry.versions[version];
      if (!versionEntry) throw new Error(`Version "${version}" not found for module "${name}"`);

      for (const [depName, constraint] of Object.entries(versionEntry.dependencies ?? {})) {
        if (!constraints.has(depName)) constraints.set(depName, []);
        constraints.get(depName).push({ constraint, requiredBy: key });
        newDeps.add(depName);
      }
    }

    if (newDeps.size === 0) break;

    // Phase 2 — three passes to ensure stale-constraint cleanup never affects a
    // version pick computed in the same round (order of depNames must not matter).

    const depNames = [...newDeps];
    const availData = await fetch(depNames);
    const availMap = new Map(availData.map(m => [m.module, m]));

    // Pass A: compute every new version using the constraint map as-is.
    const newVersions = new Map(); // depName → { newVersion, prevVersion }
    for (const depName of depNames) {
      const depConstraints = constraints.get(depName);
      if (!depConstraints?.length) continue;

      const moduleEntry = availMap.get(depName);
      if (!moduleEntry) throw new Error(`Module "${depName}" not found in the registry`);

      const versionsAvailable = Object.keys(moduleEntry.versions);
      newVersions.set(depName, {
        newVersion: pickBestVersion(depName, depConstraints, versionsAvailable, rootModules[depName], rootModuleNames),
        prevVersion: resolved[depName],
      });
    }

    // Pass B: apply all stale-constraint cleanup for version changes in one sweep.
    // Must happen before Pass C so that any dep whose only constraints came from a
    // downgraded version is excluded from resolved / nextQueue (phantom dep prevention).
    for (const [depName, { newVersion, prevVersion }] of newVersions) {
      if (prevVersion && prevVersion !== newVersion) {
        removeConstraintsFrom(constraints, `${depName}@${prevVersion}`);
        visited.delete(`${depName}@${prevVersion}`);
      }
    }

    // Pass C: commit resolved versions and build next queue.
    // Re-read constraint lists after cleanup: a dep that lost all its constraints was
    // required only by a version that was just downgraded — don't install it.
    const nextQueue = [];
    for (const [depName, { newVersion }] of newVersions) {
      const currentConstraints = constraints.get(depName);
      if (!currentConstraints?.length && !rootModules[depName]) continue;

      resolved[depName] = newVersion;
      const depKey = `${depName}@${newVersion}`;
      if (!visited.has(depKey)) {
        nextQueue.push([depName, newVersion]);
      }
    }

    queue = nextQueue;
  }

  // Post-BFS reachability pruning: constraints accumulate monotonically so resolved
  // may contain deps required only by a version that was later downgraded away.
  // Walk the final version graph from root modules and remove anything unreachable.
  // All registry data is already cached so this fetch is free.
  const finalMap = new Map(
    (await fetch(Object.keys(resolved))).map(m => [m.module, m])
  );
  const reachable = new Set(Object.keys(rootModules));
  const stack = [...Object.keys(rootModules)];
  while (stack.length > 0) {
    const name = stack.pop();
    const deps = finalMap.get(name)?.versions[resolved[name]]?.dependencies ?? {};
    for (const depName of Object.keys(deps)) {
      if (depName in resolved && !reachable.has(depName)) {
        reachable.add(depName);
        stack.push(depName);
      }
    }
  }
  for (const name of Object.keys(resolved)) {
    if (!reachable.has(name)) delete resolved[name];
  }

  return resolved;
};

/**
 * Finds the version to install for a single named module.
 *
 * - If moduleVersion is provided, verifies it exists and returns it.
 * - If moduleVersion is null/undefined, returns the highest stable (non-prerelease) version.
 * - Returns null when the specific requested version doesn't exist.
 * - Throws when the module itself is not found in the registry.
 */
const findModuleVersion = async (moduleName, moduleVersion, getVersions) => {
  const results = await getVersions([moduleName]);
  logger.Debug(`find modulesVersions: ${JSON.stringify(results)}`);

  const moduleEntry = results.find(m => m.module === moduleName);
  if (!moduleEntry) throw new Error(`Can't find module ${moduleName}`);

  const versions = Object.keys(moduleEntry.versions);

  if (moduleVersion) {
    const match = versions.find(v => v === moduleVersion);
    return match ? { [moduleName]: match } : null;
  }

  const latest = versions
    .filter(v => !semver.prerelease(v))
    .sort(semver.compare)
    .at(-1);

  return latest ? { [moduleName]: latest } : null;
};

export { resolveDependencies, findModuleVersion };
