import semver from 'semver';
import { resolveDependencies } from './dependencies.js';
import { readPosModulesLock, writePosModulesLock } from './configFiles.js';
import { POS_MODULE_LOCK_FILE, FALLBACK_REGISTRY_URL } from './paths.js';
import { downloadAllModules, modulesToDownload, modulesNotOnDisk } from './downloadModule.js';
import { formatModulesDiff } from './formatModulesDiff.js';

const buildSkipNote = (total, toDownload) => {
  const skipCount = Object.keys(total).length - Object.keys(toDownload).length;
  return skipCount > 0 ? ` (${skipCount} already up-to-date)` : '';
};

const isLockUnchanged = (resolved, previous) =>
  Object.keys(resolved).length === Object.keys(previous).length &&
  Object.entries(resolved).every(([k, v]) => previous[k] === v);

/** Prints a formatted diff between previous and new resolved module sets. */
const printDiff = (previousModules, resolvedModules) => {
  const diffLines = formatModulesDiff(previousModules, resolvedModules);
  if (diffLines.length > 0) process.stdout.write(diffLines.join('\n') + '\n');
};

/**
 * Resolves dependencies, updates the lock file (only when changed), downloads changed modules,
 * and prints a diff.
 *
 * When includeDev is true, dev deps are resolved as the delta over prod:
 *  - Production lock section (lock.dependencies)  = resolved prod dep tree
 *  - Dev lock section (lock.devDependencies)       = modules exclusively needed by dev deps
 *    (i.e. resolved(all) minus resolved(prod))
 *
 * When includeDev is false, only the production lock section is updated; the dev section
 * from the existing lock file is preserved unchanged.
 *
 * Every resolved module gets an explicit entry in the lock's registries map. This makes the
 * lock file self-contained for --frozen: no global fallback URL is needed.
 * Registry entries for modules NOT touched by this run (e.g. dev modules during a prod-only
 * run) are preserved only if those modules are still present in the dev lock section —
 * preventing stale entries for modules removed from the manifest from accumulating.
 *
 * @param {ora.Ora} spinner
 * @param {Object}   prodModules    Production dependencies map (from pos-module.json dependencies)
 * @param {Object}   devModules     Dev dependencies map (from pos-module.json devDependencies)
 * @param {string}   registryUrl   Default registry URL for modules without a per-module override.
 * @param {Function} getVersions   Registry-aware version fetcher (from createGetVersions).
 * @param {Object}   [options]
 * @param {Object}   [options.registries={}]    Per-module registry URL overrides from pos-module.json.
 * @param {boolean}  [options.includeDev=false] When true, resolves and downloads devDependencies.
 * @param {Set}      [options.newlyAdded=new Set()]  Passed through to resolveDependencies for conflict hints.
 * @returns {{ resolvedProd: Object, resolvedDev: Object, path: 'resolved' }}
 */
const resolveAndDownload = async (spinner, prodModules, devModules = {}, registryUrl, getVersions, { registries = {}, includeDev = false, newlyAdded = new Set() } = {}) => {
  const previousLock = readPosModulesLock();

  spinner.start('Resolving module dependencies');

  const resolvedProd = await resolveDependencies(prodModules, getVersions, { newlyAdded });

  let resolvedDev = {};
  if (includeDev) {
    const resolvedAll = await resolveDependencies({ ...prodModules, ...devModules }, getVersions, { newlyAdded });
    resolvedDev = Object.fromEntries(
      Object.entries(resolvedAll).filter(([k]) => !(k in resolvedProd))
    );
  }

  const prevProd = previousLock.dependencies;
  const prevDev = previousLock.devDependencies;
  const lockDevToWrite = includeDev ? resolvedDev : prevDev;

  // Build per-module registry map for all modules resolved in this run.
  const allResolved = { ...resolvedProd, ...resolvedDev };
  const expandedRegistries = Object.fromEntries(
    Object.keys(allResolved).map(name => [name, registries[name] || registryUrl])
  );

  // When doing a prod-only run (includeDev=false) the dev lock section is preserved
  // unchanged, so preserve registry entries only for those still-present dev modules.
  // This prevents orphan entries accumulating for modules removed from the manifest.
  const devRegistriesToPreserve = Object.fromEntries(
    Object.keys(lockDevToWrite)
      .filter(name => previousLock.registries[name])
      .map(name => [name, previousLock.registries[name]])
  );
  const mergedRegistries = { ...devRegistriesToPreserve, ...expandedRegistries };

  const lockUnchanged = isLockUnchanged(resolvedProd, prevProd) &&
    (!includeDev || isLockUnchanged(resolvedDev, prevDev)) &&
    isLockUnchanged(mergedRegistries, previousLock.registries);

  if (lockUnchanged) {
    spinner.succeed('Module dependencies up-to-date');
  } else {
    writePosModulesLock(resolvedProd, lockDevToWrite, mergedRegistries);
    spinner.succeed(`Modules lock file updated: ${POS_MODULE_LOCK_FILE}`);
  }

  const toDownload = {
    ...modulesToDownload(resolvedProd, prevProd),
    ...(includeDev ? modulesToDownload(resolvedDev, prevDev) : {}),
  };

  const getRegistryUrl = (name) => mergedRegistries[name] || registryUrl;
  const skipNote = buildSkipNote(allResolved, toDownload);
  spinner.start('Downloading modules');
  await downloadAllModules(toDownload, getRegistryUrl);
  spinner.succeed(`Modules downloaded successfully${skipNote}`);

  const allPrevious = includeDev ? { ...prevProd, ...prevDev } : prevProd;
  printDiff(allPrevious, allResolved);

  return { resolvedProd, resolvedDev, path: 'resolved' };
};

/** Returns true when the lock file has at least one entry in prod or dev sections. */
const lockIsNonEmpty = (lock) =>
  Object.keys(lock.dependencies).length > 0 || Object.keys(lock.devDependencies).length > 0;

/**
 * Returns true when every dependency declared in the manifest has a corresponding
 * entry in the lock file. When includeDev is true, devDependencies are also checked.
 * This is a key-presence check only — used by smartInstall to decide whether to skip
 * full resolution. For strict constraint validation use frozenInstall.
 */
const lockCoversManifestDeps = (lock, prodModules, devModules, includeDev) => {
  const allManifest = includeDev ? { ...prodModules, ...devModules } : prodModules;
  const allLock = { ...lock.dependencies, ...lock.devDependencies };
  return Object.keys(allManifest).every(name => name in allLock);
};

/**
 * Returns true when the lock is valid for the no-arg install path:
 * the lock must be non-empty and cover all manifest deps.
 */
const isLockValidForInstall = (lock, prodModules, devModules, includeDev) =>
  lockIsNonEmpty(lock) && lockCoversManifestDeps(lock, prodModules, devModules, includeDev);

/**
 * CI-safe install: uses the existing lock file as the sole source of truth.
 * No registry calls, no resolution, no lock file writes.
 *
 * Fails fast when:
 *  - the lock file does not exist (run `pos-cli modules install` first)
 *  - any dep in pos-module.json is absent from the lock file (lock is stale)
 *  - any locked version does not satisfy the constraint declared in pos-module.json
 *
 * Downloads only modules that are missing from disk; already-present modules
 * at the locked version are skipped, making it safe to cache `modules/` in CI.
 *
 * @param {ora.Ora} spinner
 * @param {Object}  prodModules              - dependencies from pos-module.json
 * @param {Object}  devModules               - devDependencies from pos-module.json
 * @param {string}  [registryUrl]            - Default registry URL; used as fallback for lock entries
 *                                             written before per-module registry stamping was introduced.
 *                                             Defaults to FALLBACK_REGISTRY_URL.
 * @param {Object}  [options]
 * @param {boolean} [options.includeDev=false] When true, validates and downloads devDependencies.
 * @returns {{ resolvedProd: Object, resolvedDev: Object, path: 'frozen' }}
 */
const frozenInstall = async (spinner, prodModules, devModules = {}, registryUrl = FALLBACK_REGISTRY_URL, { includeDev = false } = {}) => {
  const lock = readPosModulesLock();
  const lockProd = lock.dependencies;
  const lockDev = lock.devDependencies;

  if (Object.keys(lockProd).length === 0 && Object.keys(lockDev).length === 0) {
    throw new Error(
      `${POS_MODULE_LOCK_FILE} is missing or empty. Run pos-cli modules install to generate it.`
    );
  }

  const allManifest = includeDev ? { ...prodModules, ...devModules } : prodModules;
  const allLock = { ...lockProd, ...lockDev };

  // Check 1: every manifest dep must be present in the lock.
  const missing = Object.keys(allManifest).filter(name => !(name in allLock));
  if (missing.length > 0) {
    throw new Error(
      `Lock file is out of date — missing: ${missing.join(', ')}. ` +
      `Run pos-cli modules install to update it.`
    );
  }

  // Check 2: every locked version must satisfy the constraint declared in pos-module.json.
  // A range constraint that the locked version no longer satisfies indicates the manifest
  // was edited after the lock was generated (e.g. "^1.0.0" bumped to "^2.0.0" but the
  // lock still has "1.5.0"). Fail fast rather than silently installing the wrong version.
  const constraintMismatches = Object.entries(allManifest)
    .filter(([name, constraint]) => {
      const locked = allLock[name];
      if (!locked) return false; // already caught by missing check
      return !semver.satisfies(locked, constraint);
    });
  if (constraintMismatches.length > 0) {
    const detail = constraintMismatches
      .map(([name, constraint]) => `${name} is locked at ${allLock[name]} which does not satisfy ${constraint}`)
      .join(', ');
    throw new Error(
      `Lock file is out of date — version constraint mismatch: ${detail}. ` +
      `Run pos-cli modules install to update it.`
    );
  }

  spinner.succeed('Using frozen lock file');

  // Modules installed with an older pos-cli version may not have explicit registry entries.
  // Fall back to the caller-supplied registryUrl (e.g. PARTNER_PORTAL_HOST), then to the
  // hardcoded default — ensures --frozen behaves consistently with the original install.
  const getRegistryUrl = (name) => lock.registries[name] || registryUrl;
  const toDownload = {
    ...modulesNotOnDisk(lockProd),
    ...(includeDev ? modulesNotOnDisk(lockDev) : {}),
  };

  const relevantLock = includeDev ? allLock : lockProd;
  const skipNote = buildSkipNote(relevantLock, toDownload);
  spinner.start('Downloading modules');
  await downloadAllModules(toDownload, getRegistryUrl);
  spinner.succeed(`Modules downloaded successfully${skipNote}`);

  return { resolvedProd: lockProd, resolvedDev: lockDev, path: 'frozen' };
};

/**
 * Smart install (no-arg `pos-cli modules install` path):
 *  - If the lock file is valid (non-empty and covers all manifest deps) → use it directly
 *    (no registry calls, downloads only modules missing from disk).
 *  - Otherwise → fall back to full resolution (resolve + write lock + download).
 *
 * Unlike --frozen, a stale or absent lock is NOT an error — it triggers fresh resolution.
 *
 * @returns {{ resolvedProd: Object, resolvedDev: Object, path: 'frozen' | 'resolved' }}
 */
const smartInstall = async (spinner, prodModules, devModules = {}, registryUrl, getVersions, { registries = {}, includeDev = false } = {}) => {
  const lock = readPosModulesLock();

  if (isLockValidForInstall(lock, prodModules, devModules, includeDev)) {
    return frozenInstall(spinner, prodModules, devModules, registryUrl, { includeDev });
  }

  return resolveAndDownload(spinner, prodModules, devModules, registryUrl, getVersions, { registries, includeDev });
};

export { resolveAndDownload, frozenInstall, lockIsNonEmpty, lockCoversManifestDeps, isLockValidForInstall, smartInstall };
