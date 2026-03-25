/**
 * Core migration logic for `pos-cli modules migrate`.
 * Extracted from the bin command so it can be imported directly by tests
 * without spawning a child process.
 *
 * Two steps run sequentially:
 *   migrateLegacyManifest:  app/pos-modules.json → pos-module.json  (deps migration)
 *   promoteTemplateValues:  template-values.json metadata/deps → pos-module.json
 */

import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';

import files from '../files.js';
import logger from '../logger.js';
import { writePosModulesLock } from './configFiles.js';
import {
  POS_MODULE_FILE,
  POS_MODULE_LOCK_FILE,
  LEGACY_POS_MODULES_FILE,
  LEGACY_POS_MODULES_LOCK_FILE,
  APP_POS_MODULE_FILE,
  FALLBACK_REGISTRY_URL,
} from './paths.js';

const LEGACY_TEMPLATE_VALUES_GLOB = 'modules/*/template-values.json';
const METADATA_FIELDS = ['machine_name', 'version', 'name', 'repository_url'];
const DEPS_FIELDS = ['dependencies', 'devDependencies'];
// Fields that are silently stripped during migration — never promoted to pos-module.json.
const DEPRECATED_FIELDS = ['type'];

/** Returns true when the object contains at least one of the known metadata keys. */
const hasMetadata = (obj) => obj && METADATA_FIELDS.some(f => f in obj);
/** Returns true when the object contains at least one deprecated field that should be stripped. */
const hasDeprecatedFields = (obj) => obj && DEPRECATED_FIELDS.some(f => f in obj);

/**
 * Derives devDependencies from the app-level module manifest.
 * Tries new format (app/pos-module.json) first, then legacy (app/pos-modules.json).
 * Excludes the named module itself and any modules already in prodDeps.
 *
 * @param {string} moduleName        The machine_name of the module being migrated.
 * @param {object} prodDeps          Production dependencies already declared.
 * @param {object|null} preReadModules  Pre-read legacy modules map (to use when the file may
 *                                   have already been deleted by Phase A).
 * @returns {object|null}            devDependencies map, or null if nothing can be derived.
 */
const deriveDevDependenciesFromApp = (moduleName, prodDeps, preReadModules = null) => {
  // Try new-format app manifest first
  if (fs.existsSync(APP_POS_MODULE_FILE)) {
    const appManifest = files.readJSON(APP_POS_MODULE_FILE, { exit: false }) || {};
    if (appManifest.devDependencies && Object.keys(appManifest.devDependencies).length > 0) {
      return appManifest.devDependencies;
    }
  }

  // Use pre-read data when available (Phase A may have already deleted the legacy file).
  // Fall back to reading from disk if no pre-read data was provided.
  let allModules = preReadModules;
  if (!allModules) {
    if (!fs.existsSync(LEGACY_POS_MODULES_FILE)) return null;
    const legacy = files.readJSON(LEGACY_POS_MODULES_FILE, { exit: false }) || {};
    allModules = legacy.modules || {};
  }

  // Derive devDeps as everything that is not the module itself and not a production dependency.
  const devDeps = {};
  for (const [modName, version] of Object.entries(allModules)) {
    if (modName === moduleName) continue;
    if (modName in prodDeps) continue;
    devDeps[modName] = version;
  }
  return Object.keys(devDeps).length > 0 ? devDeps : null;
};

/**
 * Migrates the legacy app/pos-modules.json → pos-module.json.
 * Skipped when app/pos-modules.json does not exist or pos-module.json already exists.
 *
 * @returns {boolean} true when migration was performed
 */
const migrateLegacyManifest = async () => {
  if (!fs.existsSync(LEGACY_POS_MODULES_FILE)) {
    logger.Info(`No ${LEGACY_POS_MODULES_FILE} found — skipping deps migration.`);
    return false;
  }

  if (fs.existsSync(POS_MODULE_FILE)) {
    logger.Info(`${POS_MODULE_FILE} already exists — skipping deps migration.`);
    return false;
  }

  logger.Info(`Migrating ${LEGACY_POS_MODULES_FILE} → ${POS_MODULE_FILE} ...`);

  // 1. Read legacy manifest
  const legacy = files.readJSON(LEGACY_POS_MODULES_FILE, { exit: false });
  const { modules, repository_url, ...otherFields } = legacy;

  // 2. Build new manifest — map `modules` → `dependencies`.
  const newManifest = { ...otherFields, dependencies: modules || {} };
  if (repository_url && repository_url !== FALLBACK_REGISTRY_URL) {
    newManifest.repository_url = repository_url;
  }

  // 3. Merge publishing metadata from modules/*/template-values.json (if exactly one found)
  const templateValueFiles = await glob(LEGACY_TEMPLATE_VALUES_GLOB);
  if (templateValueFiles.length === 1) {
    const tvConfig = files.readJSON(templateValueFiles[0], { throwDoesNotExistError: false });
    const { name, machine_name, version } = tvConfig;
    if (machine_name) newManifest.machine_name = machine_name;
    if (name) newManifest.name = name;
    if (version) newManifest.version = version;
    logger.Info(`  Merged publishing metadata from ${templateValueFiles[0]}`);
  } else if (templateValueFiles.length > 1) {
    logger.Warn(`  Found multiple template-values.json files — skipping metadata merge. Add name/machine_name/version to ${POS_MODULE_FILE} manually.`);
  }

  // 4. Read legacy lock before any writes (fail fast if unreadable)
  const hasLegacyLock = fs.existsSync(LEGACY_POS_MODULES_LOCK_FILE);
  let legacyLock = null;
  if (hasLegacyLock) {
    legacyLock = files.readJSON(LEGACY_POS_MODULES_LOCK_FILE, { exit: false });
  }

  // 5. Write all new files first, then remove old ones (transactional order)
  fs.writeFileSync(
    path.join(process.cwd(), POS_MODULE_FILE),
    JSON.stringify(newManifest, null, 2)
  );
  logger.Info(`  Written: ${POS_MODULE_FILE}`);

  if (legacyLock !== null) {
    logger.Info(`Migrating ${LEGACY_POS_MODULES_LOCK_FILE} → ${POS_MODULE_LOCK_FILE} ...`);
    const legacyModules = legacyLock.modules || {};
    const registryUrl = legacyLock.repository_url || FALLBACK_REGISTRY_URL;
    const registries = Object.fromEntries(Object.keys(legacyModules).map(name => [name, registryUrl]));
    writePosModulesLock(legacyModules, {}, registries);
    logger.Info(`  Written: ${POS_MODULE_LOCK_FILE}`);
  }

  // 6. Remove legacy files only after all new files are safely written
  fs.rmSync(LEGACY_POS_MODULES_FILE);
  logger.Info(`  Removed: ${LEGACY_POS_MODULES_FILE}`);

  if (hasLegacyLock) {
    fs.rmSync(LEGACY_POS_MODULES_LOCK_FILE);
    logger.Info(`  Removed: ${LEGACY_POS_MODULES_LOCK_FILE}`);
  }

  return true;
};

/**
 * Promotes fields from template-values.json → pos-module.json.
 * Without --name: merges only metadata fields (machine_name, version, name, repository_url).
 * With --name: also migrates dependencies and devDependencies; derives devDependencies from
 * the app-level manifest when they are not already declared in template-values.json.
 * Never overwrites existing values in pos-module.json (except deps overridden when
 * migrateLegacyManifest ran and wrote a flat module list in the same execution).
 * Strips migrated fields from template-values.json; deletes it when it becomes empty.
 *
 * Source priority:
 *   1. Root template-values.json
 *   2. modules/${name}/template-values.json  (--name flag)
 *   3. modules/{name}/template-values.json  (auto-detect; error when multiple found)
 *
 * @param {string|undefined} name                     Optional machine_name to target a specific module directory.
 * @param {object|null}     preReadModules            Pre-read legacy modules map passed from migrateModuleManifest.
 * @param {boolean}         legacyManifestMigrated    Whether migrateLegacyManifest ran (wrote a flat deps list).
 * @returns {boolean} true when migration was performed
 */
const promoteTemplateValues = async (name, preReadModules = null, legacyManifestMigrated = false) => {
  let tvPath = null;
  let tvSource = null;

  // Priority 1: root template-values.json
  if (fs.existsSync('template-values.json')) {
    const content = files.readJSON('template-values.json', { exit: false }) || {};
    if (hasMetadata(content) || hasDeprecatedFields(content)) {
      tvPath = 'template-values.json';
      tvSource = content;
    }
  }

  // Priority 2/3: modules/*/template-values.json
  if (!tvSource) {
    const globPattern = name ? `modules/${name}/template-values.json` : LEGACY_TEMPLATE_VALUES_GLOB;
    const candidates = await glob(globPattern);
    // Read each file once and carry the content forward to avoid double reads.
    // When --name is given, also treat a file with only deps fields as migratable.
    // Always treat files with only deprecated fields as migratable (for cleanup).
    const hasMigratableFields = (content) =>
      hasMetadata(content) || hasDeprecatedFields(content) || (name && DEPS_FIELDS.some(f => f in content));
    const withMetadata = candidates
      .map(f => ({ f, content: files.readJSON(f, { exit: false }) || {} }))
      .filter(({ content }) => hasMigratableFields(content));

    if (withMetadata.length > 1) {
      throw new Error(
        `Multiple modules/*/template-values.json files contain migratable fields.\n` +
        `Run: pos-cli modules migrate --name <machine_name>`
      );
    }

    if (withMetadata.length === 1) {
      tvPath = withMetadata[0].f;
      tvSource = withMetadata[0].content;
    }
  }

  if (!tvSource) {
    logger.Info('No template-values.json with metadata fields found — skipping metadata migration.');
    return false;
  }

  logger.Info(`Found ${tvPath} with metadata fields.`);

  // When --name is given, also migrate dependencies so the module's declared
  // deps move into the unified root manifest alongside its publishing metadata.
  const fieldsToMigrate = name ? [...METADATA_FIELDS, ...DEPS_FIELDS] : METADATA_FIELDS;

  // Read or create pos-module.json
  let manifest = {};
  if (fs.existsSync(POS_MODULE_FILE)) {
    manifest = files.readJSON(POS_MODULE_FILE, { exit: false }) || {};
  }

  // Merge fields into the manifest.
  // Metadata fields (machine_name, version, etc.) never overwrite existing values.
  // Deps fields (dependencies, devDependencies) override the manifest when --name is given AND
  // Phase A ran in this execution: Phase A writes a flat module list as `dependencies`, which
  // is not the module's declared deps. template-values.json is the authoritative source.
  // If Phase A did not run, the existing deps were user-set and must be respected.
  const depsFieldSet = new Set(DEPS_FIELDS);
  const shouldOverride = (field) => name && legacyManifestMigrated && depsFieldSet.has(field);
  for (const field of fieldsToMigrate) {
    if (!(field in tvSource)) continue;
    const value = tvSource[field];
    const alreadyPresent = field in manifest;
    if (alreadyPresent && !shouldOverride(field)) {
      logger.Info(`  ${field} already in ${POS_MODULE_FILE} — skipped.`);
    } else {
      manifest[field] = value;
      logger.Info(`  ${field} → ${alreadyPresent ? 'replaced' : 'added'} in ${POS_MODULE_FILE}.`);
    }
  }

  // When --name is given, derive devDependencies from the app-level manifest
  // if not already set (neither from template-values.json nor pos-module.json).
  if (name && !('devDependencies' in manifest)) {
    const prodDeps = manifest.dependencies || {};
    const derivedDevDeps = deriveDevDependenciesFromApp(name, prodDeps, preReadModules);
    if (derivedDevDeps) {
      manifest.devDependencies = derivedDevDeps;
      logger.Info(`  devDependencies derived from app-level manifest → added to ${POS_MODULE_FILE}.`);
    }
  }

  // Log and strip deprecated fields (never promoted to pos-module.json).
  for (const field of DEPRECATED_FIELDS) {
    if (field in tvSource) {
      logger.Info(`  ${field} is deprecated and has no effect — stripped from ${tvPath}.`);
    }
  }

  // Compute the post-strip template-values.json content before any writes so we
  // know the full target state and can give a precise recovery hint on partial failure.
  const allFieldsToStrip = [...fieldsToMigrate, ...DEPRECATED_FIELDS];
  const remaining = Object.fromEntries(
    Object.entries(tvSource).filter(([k]) => !allFieldsToStrip.includes(k))
  );

  // Write pos-module.json first — it is the primary target.
  // If the subsequent template-values.json cleanup fails the user will see a recovery hint.
  fs.writeFileSync(
    path.join(process.cwd(), POS_MODULE_FILE),
    JSON.stringify(manifest, null, 2)
  );
  logger.Info(`  Written: ${POS_MODULE_FILE}`);

  // Strip metadata fields from template-values.json.
  // Wrapped in try/catch: pos-module.json is already correct at this point, so a
  // failure here is recoverable — the user can strip the fields from tvPath manually.
  try {
    if (Object.keys(remaining).length === 0) {
      fs.rmSync(tvPath);
      logger.Info(`  ${tvPath} is now empty — deleted.`);
    } else {
      fs.writeFileSync(path.join(process.cwd(), tvPath), JSON.stringify(remaining, null, 2));
      const customKeys = Object.keys(remaining).join(', ');
      logger.Info(`  ${tvPath} retained (contains custom template variables: ${customKeys}).`);
    }
  } catch (e) {
    logger.Warn(
      `  Could not update ${tvPath}: ${e.message}.\n` +
      `  ${POS_MODULE_FILE} has been updated. ` +
      `You can safely remove the migrated fields (${allFieldsToStrip.join(', ')}) from ${tvPath} manually.`
    );
  }

  return true;
};

/**
 * Migrates legacy module config files to the new layout.
 * Runs migrateLegacyManifest then promoteTemplateValues sequentially.
 * Each step is independently idempotent.
 *
 * @param {object} [opts]
 * @param {string} [opts.name]  Optional machine_name to target a specific module directory (promoteTemplateValues).
 * @returns {{ status: 'migrated' | 'nothing_to_migrate' }}
 */
const migrateModuleManifest = async ({ name } = {}) => {
  try {
    // Pre-read the legacy flat modules before migrateLegacyManifest may delete it.
    // promoteTemplateValues uses this data to derive devDependencies when --name is given.
    let preReadModules = null;
    if (name && fs.existsSync(LEGACY_POS_MODULES_FILE)) {
      const legacy = files.readJSON(LEGACY_POS_MODULES_FILE, { exit: false }) || {};
      preReadModules = legacy.modules || {};
    }

    const legacyMigrated = await migrateLegacyManifest();
    const templateValuesMigrated = await promoteTemplateValues(name, preReadModules, legacyMigrated);

    if (legacyMigrated || templateValuesMigrated) {
      logger.Success(`Migration complete. Please commit ${POS_MODULE_FILE}.`);
      return { status: 'migrated' };
    }

    logger.Info('Nothing to migrate.');
    return { status: 'nothing_to_migrate' };
  } catch (e) {
    logger.Error(`Migration failed: ${e.message}`);
    process.exitCode = 1;
    return { status: 'error', error: e };
  }
};

export { migrateModuleManifest };
