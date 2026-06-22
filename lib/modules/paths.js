/**
 * Central source of truth for all file-path constants used by the module system.
 * Import from here to avoid the same string being defined in multiple files.
 */

import path from 'path';

export const POS_MODULE_FILE = 'pos-module.json';
export const POS_MODULE_LOCK_FILE = 'pos-module.lock.json';
export const LEGACY_POS_MODULES_FILE = 'app/pos-modules.json';
export const LEGACY_POS_MODULES_LOCK_FILE = 'app/pos-modules.lock.json';
export const APP_POS_MODULE_FILE = 'app/pos-module.json';
export const FALLBACK_REGISTRY_URL = 'https://partners.platformos.com';

/** Absolute path to the project's `modules/` directory. */
export const getModulesDir = () => path.join(process.cwd(), 'modules');
/** Absolute path to an installed module's directory: `modules/<name>`. */
export const getModulePath = (name) => path.join(getModulesDir(), name);
