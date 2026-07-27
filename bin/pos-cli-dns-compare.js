#!/usr/bin/env node

import chalk from 'chalk';

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { resolvePortalContext } from '../lib/dns/auth.js';
import { fetchDomains } from '../lib/dns/export.js';
import { readEnvelope } from '../lib/dns/exportSchema.js';
import { compareInstance, emptyTotals } from '../lib/dns/compare.js';
import { parseMappingFile } from '../lib/dns/mapping.js';
import { collect, dropValuePatterns, filterOutcomeByDomain, portalFlags, reportError } from '../lib/dns/cliHelpers.js';

const LEVEL_COLORS = {
  OK: chalk.green,
  ADVISORY: chalk.yellow,
  CRITICAL: chalk.red,
  MISSING_BEFORE: chalk.red,
  MISSING_AFTER: chalk.red
};

// One side of the comparison: an export file (offline) or a live portal fetch.
const loadSide = async (envName, { file, ...portalOptions }) => {
  if (file) {
    const envelope = readEnvelope(file);
    return { domains: envelope.domains, origin: `${file} (exported ${envelope.exported_at} from ${envelope.portal_url})` };
  }
  const context = await resolvePortalContext(envName, { ...portalOptions, readOnly: true });
  const { domains } = await fetchDomains(context.client, context.instanceUuid);
  return { domains, origin: `${context.portalUrl} (instance ${context.instanceUuid})` };
};

const renderResults = (results) => results.map(result => {
  const paint = LEVEL_COLORS[result.level] || chalk.white;
  const lines = [`${paint(result.level.padEnd(14))} ${result.domainName}  ${result.status ? `[${result.status}]` : ''}`];
  for (const message of result.critical) lines.push(`  ${message}`);
  for (const message of result.advisory) lines.push(chalk.gray(`  (advisory) ${message}`));
  return lines.join('\n');
}).join('\n');

// The pass/fail rule and the totals line are shared by bulk and single-pair modes.
const totalsFailed = (totals) => totals.critical > 0 || totals.missingBefore > 0 || totals.missingAfter > 0;

const renderTotalsLine = (totals) =>
  `OK: ${totals.ok}  Advisory: ${totals.advisory}  Critical: ${totals.critical}  ` +
  `Missing on source: ${totals.missingBefore}  Missing on target: ${totals.missingAfter}`;

program.showHelpAfterError();
program
  .name('pos-cli dns compare')
  .arguments('[sourceEnv]')
  .arguments('[targetEnv]')
  .option('--source-file <path>', 'compare from an export file instead of the live source portal')
  .option('--target-file <path>', 'compare against an export file instead of the live target portal')
  .option('--mapping-file <path>', 'bulk: CSV source_uuid,target_uuid[,label] or JSON array of pairs')
  .option('--domain <name>', 'only compare this domain (repeatable)', collect, [])
  .option('--drop-value <regex>', 'ignore records whose value matches this pattern — use the same patterns the migration dropped (repeatable)', collect, [])
  .option('--raw', 'exact same-stack semantics: no transform, include data_center/nameserver/DCV-value differences')
  .option('--ignore-status', 'downgrade status mismatches to advisory (useful before cutover)')
  .option('--source-portal-url <url>', 'source Partner Portal url')
  .option('--source-token <token>', 'source portal API token')
  .option('--source-email <email>', 'authenticate the source portal with email + password prompt')
  .option('--source-instance-uuid <uuid>', 'source instance uuid (skips lookup by the environment domain)')
  .option('--target-portal-url <url>', 'target Partner Portal url')
  .option('--target-token <token>', 'target portal API token')
  .option('--target-email <email>', 'authenticate the target portal with email + password prompt')
  .option('--target-instance-uuid <uuid>', 'target instance uuid (skips lookup by the environment domain)')
  .option('--json', 'machine-readable output')
  .action(async (sourceEnv, targetEnv, params) => {
    try {
      const compareOptions = {
        transform: !params.raw,
        ignoreStatus: !!params.ignoreStatus,
        dropValuePatterns: dropValuePatterns(params.dropValue)
      };

      if (params.mappingFile) {
        // Bulk cohort mode: one compare per mapped instance pair, live portals only.
        const sourceContext = await resolvePortalContext(sourceEnv, {
          ...portalFlags(params, 'source'), readOnly: true, skipInstanceLookup: true
        });
        const targetContext = await resolvePortalContext(targetEnv, {
          ...portalFlags(params, 'target'), readOnly: true, skipInstanceLookup: true
        });

        const grand = emptyTotals();
        const perInstance = [];
        for (const pair of parseMappingFile(params.mappingFile)) {
          try {
            const [sourceSide, targetSide] = await Promise.all([
              fetchDomains(sourceContext.client, pair.sourceUuid),
              fetchDomains(targetContext.client, pair.targetUuid)
            ]);
            const outcome = filterOutcomeByDomain(compareInstance(sourceSide.domains, targetSide.domains, compareOptions), params.domain);
            perInstance.push({ label: pair.label, ...outcome });
            for (const key of Object.keys(grand)) grand[key] += outcome.totals[key];
            if (!params.json) {
              await logger.Info(`\n=== ${pair.label} ===\n${renderResults(outcome.results)}`, { hideTimestamp: true });
            }
          } catch (error) {
            perInstance.push({ label: pair.label, error: error.message });
            grand.critical += 1;
            if (!params.json) await logger.Warn(`${pair.label}: compare failed — ${error.message}`);
          }
        }

        if (params.json) {
          console.log(JSON.stringify({ instances: perInstance, totals: grand }, null, 2));
        } else {
          await logger.Info(`\n${renderTotalsLine(grand)}`, { hideTimestamp: true });
        }
        process.exit(totalsFailed(grand) ? 1 : 0);
      }

      // Sequentially, NOT Promise.all: each side may need an interactive password
      // prompt (readline on the shared stdin) — two concurrent prompts would race
      // for the same typed input and send one portal's password to the other.
      const source = await loadSide(sourceEnv, { file: params.sourceFile, ...portalFlags(params, 'source') });
      const target = await loadSide(targetEnv, { file: params.targetFile, ...portalFlags(params, 'target') });

      const { results, totals } = filterOutcomeByDomain(compareInstance(source.domains, target.domains, compareOptions), params.domain);

      if (params.json) {
        console.log(JSON.stringify({ source: source.origin, target: target.origin, results, totals }, null, 2));
      } else {
        await logger.Info(
          `Comparing ${source.origin}\n  against ${target.origin}\n\n${renderResults(results)}\n\n${renderTotalsLine(totals)}`,
          { hideTimestamp: true }
        );
      }

      process.exit(totalsFailed(totals) ? 1 : 0);
    } catch (error) {
      await reportError(error);
    }
  });

program.parse(process.argv);
