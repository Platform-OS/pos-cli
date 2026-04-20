/**
 * Manifest file strategies for the module system.
 *
 * Each strategy handles one on-disk format and normalises it to the common
 * internal shape:
 *   { dependencies, devDependencies, repositoryUrl, registries, ...rest }
 *
 * Strategies are tried in priority order by ManifestReader (configFiles.js).
 * Adding support for a new format is a matter of adding a strategy here.
 */

import fs from 'fs';

import files from '../../files.js';
import logger from '../../logger.js';
import { POS_MODULE_FILE, LEGACY_POS_MODULES_FILE } from '../paths.js';

// Emit the legacy-format migration warning at most once per working directory.
// Using a Set of cwd paths rather than a plain boolean means the warning fires
// once per unique project (cwd) in the lifetime of the process — which is always
// a single project in production, and a unique tmpDir per test in the test suite.
const warnedCwds = new Set();

/**
 * Handles the current canonical manifest format: pos-module.json at the project root.
 * No transformation is needed — the file schema matches the internal representation.
 */
const PosModuleJsonStrategy = {
  canHandle: () => fs.existsSync(POS_MODULE_FILE),
  read: () => files.readJSON(POS_MODULE_FILE, { throwDoesNotExistError: false }) ?? {}
};

/**
 * Handles the legacy app/pos-modules.json format.
 * The old format stored dependencies under the key `modules`; this strategy
 * maps that to `dependencies` so callers see a uniform shape.
 * Emits a migration warning on every read.
 */
const LegacyAppPosModulesStrategy = {
  canHandle: () => fs.existsSync(LEGACY_POS_MODULES_FILE),
  read: () => {
    const cwd = process.cwd();
    if (!warnedCwds.has(cwd)) {
      warnedCwds.add(cwd);
      logger.Warn(
        `Found ${LEGACY_POS_MODULES_FILE} — please migrate to ${POS_MODULE_FILE} at the project root.\n       Run: pos-cli modules migrate`
      );
    }
    const legacy = files.readJSON(LEGACY_POS_MODULES_FILE, { throwDoesNotExistError: false });
    return { ...legacy, dependencies: legacy.dependencies || legacy.modules || {} };
  }
};

/**
 * Fallback strategy — always matches, returns an empty manifest.
 * Ensures MANIFEST_STRATEGIES.find(...) never returns undefined.
 */
const FallbackStrategy = {
  canHandle: () => true,
  read: () => ({})
};

const MANIFEST_STRATEGIES = [
  PosModuleJsonStrategy,
  LegacyAppPosModulesStrategy,
  FallbackStrategy
];

export { MANIFEST_STRATEGIES };
