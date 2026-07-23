#!/usr/bin/env node

import fs from 'fs';
import chalk from 'chalk';

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { resolvePortalContext } from '../lib/dns/auth.js';
import { fetchDomains } from '../lib/dns/export.js';
import { validateEnvelope } from '../lib/dns/exportSchema.js';
import { compareInstance } from '../lib/dns/compare.js';
import { parseMappingFile } from '../lib/dns/mapping.js';

const collect = (value, previous) => previous.concat([value]);

const LEVEL_COLORS = {
  OK: chalk.green,
  ADVISORY: chalk.yellow,
  CRITICAL: chalk.red,
  MISSING_BEFORE: chalk.red,
  MISSING_AFTER: chalk.red
};

// One side of the comparison: an export file (offline) or a live portal fetch.
const loadSide = async (envName, { file, portalUrl, token, email, instanceUuid, label }) => {
  if (file) {
    const envelope = validateEnvelope(JSON.parse(fs.readFileSync(file, 'utf8')));
    return { domains: envelope.domains, origin: `${file} (exported ${envelope.exported_at} from ${envelope.portal_url})` };
  }
  const context = await resolvePortalContext(envName, { portalUrl, token, email, instanceUuid, label, readOnly: true });
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

program.showHelpAfterError();
program
  .name('pos-cli dns compare')
  .arguments('[sourceEnv]')
  .arguments('[targetEnv]')
  .option('--source-file <path>', 'compare from an export file instead of the live source portal')
  .option('--target-file <path>', 'compare against an export file instead of the live target portal')
  .option('--mapping-file <path>', 'bulk: CSV source_uuid,target_uuid[,label] or JSON array of pairs')
  .option('--domain <name>', 'only compare this domain (repeatable)', collect, [])
  .option('--raw', 'exact same-stack semantics: no transform, include data_center/nameserver/DCV-value differences')
  .option('--ignore-status', 'downgrade status mismatches to advisory (useful before cutover)')
  .option('--source-portal-url <url>').option('--source-token <token>').option('--source-email <email>').option('--source-instance-uuid <uuid>')
  .option('--target-portal-url <url>').option('--target-token <token>').option('--target-email <email>').option('--target-instance-uuid <uuid>')
  .option('--json', 'machine-readable output')
  .action(async (sourceEnv, targetEnv, params) => {
    try {
      if (params.mappingFile) {
        // Bulk cohort mode: one compare per mapped instance pair, live portals only.
        const sourceContext = await resolvePortalContext(sourceEnv, {
          portalUrl: params.sourcePortalUrl, token: params.sourceToken, email: params.sourceEmail,
          label: 'source', readOnly: true, skipInstanceLookup: true
        });
        const targetContext = await resolvePortalContext(targetEnv, {
          portalUrl: params.targetPortalUrl, token: params.targetToken, email: params.targetEmail,
          label: 'target', readOnly: true, skipInstanceLookup: true
        });

        const grand = { ok: 0, advisory: 0, critical: 0, missingBefore: 0, missingAfter: 0 };
        const perInstance = [];
        for (const pair of parseMappingFile(params.mappingFile)) {
          try {
            const [sourceSide, targetSide] = await Promise.all([
              fetchDomains(sourceContext.client, pair.sourceUuid),
              fetchDomains(targetContext.client, pair.targetUuid)
            ]);
            const outcome = compareInstance(sourceSide.domains, targetSide.domains, {
              transform: !params.raw,
              ignoreStatus: !!params.ignoreStatus
            });
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

        const failed = grand.critical > 0 || grand.missingBefore > 0 || grand.missingAfter > 0;
        if (params.json) {
          console.log(JSON.stringify({ instances: perInstance, totals: grand }, null, 2));
        } else {
          await logger.Info(
            `\nOK: ${grand.ok}  Advisory: ${grand.advisory}  Critical: ${grand.critical}  ` +
            `Missing on source: ${grand.missingBefore}  Missing on target: ${grand.missingAfter}`,
            { hideTimestamp: true }
          );
        }
        process.exit(failed ? 1 : 0);
      }

      const source = await loadSide(sourceEnv, {
        file: params.sourceFile,
        portalUrl: params.sourcePortalUrl,
        token: params.sourceToken,
        email: params.sourceEmail,
        instanceUuid: params.sourceInstanceUuid,
        label: 'source'
      });
      const target = await loadSide(targetEnv, {
        file: params.targetFile,
        portalUrl: params.targetPortalUrl,
        token: params.targetToken,
        email: params.targetEmail,
        instanceUuid: params.targetInstanceUuid,
        label: 'target'
      });

      let { results, totals } = compareInstance(source.domains, target.domains, {
        transform: !params.raw,
        ignoreStatus: !!params.ignoreStatus
      });

      if (params.domain.length) {
        const wanted = new Set(params.domain.map(domain => domain.toLowerCase()));
        results = results.filter(result => wanted.has(result.domainName.toLowerCase()));
        totals = results.reduce((acc, result) => {
          const key = { OK: 'ok', ADVISORY: 'advisory', CRITICAL: 'critical', MISSING_BEFORE: 'missingBefore', MISSING_AFTER: 'missingAfter' }[result.level];
          acc[key] += 1;
          return acc;
        }, { ok: 0, advisory: 0, critical: 0, missingBefore: 0, missingAfter: 0 });
      }

      const failed = totals.critical > 0 || totals.missingBefore > 0 || totals.missingAfter > 0;

      if (params.json) {
        console.log(JSON.stringify({ source: source.origin, target: target.origin, results, totals }, null, 2));
      } else {
        await logger.Info(
          `Comparing ${source.origin}\n  against ${target.origin}\n\n${renderResults(results)}\n\n` +
          `OK: ${totals.ok}  Advisory: ${totals.advisory}  Critical: ${totals.critical}  ` +
          `Missing on source: ${totals.missingBefore}  Missing on target: ${totals.missingAfter}`,
          { hideTimestamp: true }
        );
      }

      process.exit(failed ? 1 : 0);
    } catch (error) {
      logger.Error(error.message || error);
    }
  });

program.parse(process.argv);
