import semver from 'semver';
import logger from '../logger.js';
import { parseModuleArg } from './parseModuleArg.js';

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

/** Appends a constraint entry to the constraint map, initialising the list if needed. */
const addConstraint = (constraints, name, entry) => {
  if (!constraints.has(name)) constraints.set(name, []);
  constraints.get(name).push(entry);
};


/**
 * Returns stable versions when any exist, otherwise all versions.
 * Used to implement the "prefer stable, fall back to pre-release" policy.
 */
const stableFirst = (versions) => {
  const stable = versions.filter(v => !semver.prerelease(v));
  return stable.length > 0 ? stable : versions;
};

/**
 * Returns the latest stable version from a list, or the latest pre-release
 * when no stable version exists. Returns null for an empty list.
 */
const latestStable = (versions) => stableFirst(versions).sort(semver.compare).at(-1) ?? null;

/**
 * Returns the highest available version satisfying all constraints simultaneously.
 *
 * When pinnedVersion is provided (the dep appears in root pos-module.json) it is
 * validated against all constraints rather than auto-resolved — the user owns that pin.
 *
 * rootModuleNames is used only for error attribution: constraints coming from root
 * modules are annotated and a hint is appended when multiple root modules conflict.
 *
 * newlyAdded is the set of module names being freshly installed in this operation.
 * Constraints from those modules are not labeled "root module" even if the module is
 * in rootModuleNames, and a targeted hint is shown instead of the generic one.
 *
 * Note: pre-release versions are excluded from range matching by the semver library
 * unless the range itself contains a pre-release tag (standard npm behaviour).
 */
const pickBestVersion = (depName, allConstraints, versionsAvailable, pinnedVersion, rootModuleNames = new Set(), newlyAdded = new Set()) => {
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
        `Version conflict: "${depName}" is pinned to ${pinnedVersion} in pos-module.json ` +
        `but does not satisfy: ${detail}. ` +
        `Update "${depName}" in pos-module.json to a compatible version.`
      );
    }
    return pinnedVersion;
  }

  const best = versionsAvailable
    .filter(v => allConstraints.every(({ constraint: c }) => semver.satisfies(v, c)))
    .sort(semver.compare)
    .at(-1);

  if (!best) {
    const rootsInvolved = new Set();
    const newlyAddedInvolved = new Set();
    const detail = allConstraints
      .map(({ constraint, requiredBy }) => {
        const mod = parseModuleArg(requiredBy)[0];
        const isRoot = rootModuleNames.has(mod);
        const isNew = newlyAdded.has(mod);
        if (isRoot && !isNew) rootsInvolved.add(mod);
        if (isNew) newlyAddedInvolved.add(mod);
        return `${constraint} (required by ${requiredBy}${isRoot && !isNew ? ', root module' : ''})`;
      })
      .join(', ');
    let hint = '';
    if (newlyAddedInvolved.size > 0) {
      hint = ` Try a different version of ${[...newlyAddedInvolved].join(', ')}.`;
    } else if (rootsInvolved.size >= 2) {
      hint = ` Conflicting root modules: ${[...rootsInvolved].join(', ')}. Try updating them one at a time.`;
    }
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
 * @param {Object}   rootModules  - { name: versionOrRange } from pos-module.json
 * @param {Function} getVersions  - async (names[]) => moduleVersionData[]
 * @param {Object}   [options]
 * @param {Set}      [options.newlyAdded=new Set()]  Module names being freshly installed in this
 *                                                   operation. Used to suppress the "root module"
 *                                                   label and tailor conflict hints.
 */
const resolveDependencies = async (rootModules, getVersions, { newlyAdded = new Set() } = {}) => {
  if (Object.keys(rootModules).length === 0) return {};

  const cachedFetch = withCache(getVersions);
  const resolved = {};                  // name → exact version (refined as tree is walked)
  const constraints = new Map();        // name → [{ constraint, requiredBy }]
  const visited = new Set();            // "name@version" whose deps have been collected
  const rootModuleNames = new Set(Object.keys(rootModules));

  // Pre-pass: separate exact pins from range roots.
  // Exact pins are seeded directly into resolved and honoured as hard pins by pickBestVersion.
  // Range roots are added as constraints and resolved to an exact version before BFS starts.
  const exactPins = {};
  const rangeRoots = [];
  for (const [name, versionOrRange] of Object.entries(rootModules)) {
    if (semver.valid(versionOrRange)) {
      exactPins[name] = versionOrRange;
      resolved[name] = versionOrRange;
    } else {
      rangeRoots.push(name);
      addConstraint(constraints, name, { constraint: versionOrRange, requiredBy: `${name}@pos-module.json` });
    }
  }

  if (rangeRoots.length > 0) {
    const availData = await cachedFetch(rangeRoots);
    const availMap = new Map(availData.map(m => [m.module, m]));
    for (const name of rangeRoots) {
      const moduleEntry = availMap.get(name);
      if (!moduleEntry) throw new Error(`Module "${name}" not found in the registry`);
      const versionsAvailable = Object.keys(moduleEntry.versions);
      resolved[name] = pickBestVersion(name, constraints.get(name) ?? [], versionsAvailable, null, rootModuleNames, newlyAdded);
    }
  }

  let queue = Object.entries(resolved);
  let bfsRound = 0;
  // 500 rounds is sufficient for realistic dependency trees (each round = one tree level).
  // Non-convergence means an ever-shifting set of constraints — most commonly caused by
  // cascading version conflicts that keep downgrading modules without reaching a stable state,
  // or by inconsistent registry data (e.g. a version that lists itself as a dependency).
  const maxBfsRounds = 500;

  while (queue.length > 0) {
    if (++bfsRound > maxBfsRounds) {
      throw new Error(
        `Dependency resolution did not converge after ${maxBfsRounds} rounds. ` +
        `This usually means the registry contains incompatible version constraints that cannot be satisfied simultaneously. ` +
        `Run with DEBUG=1 to see the full constraint log.`
      );
    }
    const names = [...new Set(queue.map(([name]) => name))];
    const versionData = await cachedFetch(names);
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
        if (depName === name) {
          throw new Error(`Circular dependency detected: "${name}" requires itself`);
        }
        addConstraint(constraints, depName, { constraint, requiredBy: key });
        newDeps.add(depName);
      }
    }

    if (newDeps.size === 0) break;

    // Phase 2 — three passes to ensure stale-constraint cleanup never affects a
    // version pick computed in the same round (order of depNames must not matter).

    const depNames = [...newDeps];
    const availData = await cachedFetch(depNames);
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
        newVersion: pickBestVersion(depName, depConstraints, versionsAvailable, exactPins[depName], rootModuleNames, newlyAdded),
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
      if (!currentConstraints?.length && !exactPins[depName]) continue;

      resolved[depName] = newVersion;
      if (!visited.has(`${depName}@${newVersion}`)) {
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
    (await cachedFetch(Object.keys(resolved))).map(m => [m.module, m])
  );
  const reachable = new Set(rootModuleNames);
  const stack = [...rootModuleNames];
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
 * - If moduleVersion is an exact version, verifies it exists and returns it.
 * - If moduleVersion is a semver range, returns the highest stable version satisfying it
 *   (falls back to latest pre-release when no stable version satisfies the range).
 * - If moduleVersion is null/undefined, returns the highest stable (non-prerelease) version.
 * - Returns null when no version satisfies the request.
 * - Throws when the module itself is not found in the registry.
 */
const findModuleVersion = async (moduleName, moduleVersion, getVersions) => {
  const results = await getVersions([moduleName]);
  logger.Debug(`find modulesVersions: ${JSON.stringify(results)}`);

  const moduleEntry = results.find(m => m.module === moduleName);
  if (!moduleEntry) throw new Error(`Can't find module ${moduleName}`);

  const versions = Object.keys(moduleEntry.versions);

  if (semver.valid(moduleVersion)) {
    return versions.includes(moduleVersion) ? { [moduleName]: moduleVersion } : null;
  }
  if (semver.validRange(moduleVersion)) {
    const best = semver.maxSatisfying(stableFirst(versions), moduleVersion);
    return best ? { [moduleName]: best } : null;
  }
  if (moduleVersion) return null; // non-empty but not a valid version or range

  const latest = latestStable(versions);
  return latest ? { [moduleName]: latest } : null;
};

export { resolveDependencies, findModuleVersion };
