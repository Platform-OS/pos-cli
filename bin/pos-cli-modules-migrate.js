#!/usr/bin/env node

/**
 * pos-cli modules migrate
 *
 * Two-phase migration:
 *
 * Phase A — Deps migration:
 *   app/pos-modules.json      → pos-module.json       (modules key → dependencies)
 *   app/pos-modules.lock.json → pos-module.lock.json  (modules key → { dependencies })
 *
 * Phase B — Metadata migration:
 *   template-values.json (machine_name, version, name, repository_url) → pos-module.json
 *   Strips migrated fields from template-values.json; deletes it when it becomes empty.
 *
 * Each phase is independently idempotent. Use --name to target a specific module directory
 * when multiple modules/<name>/template-values.json files are present.
 */

import { program } from '../lib/program.js';
import { migrateModuleManifest } from '../lib/modules/migrate.js';

program
  .name('pos-cli modules migrate')
  .description('Migrate legacy module config files to pos-module.json')
  .option('--name <machine_name>', 'Target a specific modules/<name>/template-values.json (Phase B only)')
  .action(async ({ name } = {}) => {
    await migrateModuleManifest({ name });
  });

program.parse(process.argv);
