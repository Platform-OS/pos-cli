#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import ora from 'ora';
import table from 'text-table';

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { resolvePortalContext } from '../lib/dns/auth.js';
import { exportInstance } from '../lib/dns/export.js';
import { transformEnvelope } from '../lib/dns/transform.js';
import { applyPlans } from '../lib/dns/apply.js';
import { renderPlans, renderSummary, renderResults } from '../lib/dns/plan.js';
import { renderCutovers } from '../lib/dns/cutover.js';
import { parseInstancesFile, parseMappingFile, matchByDomain } from '../lib/dns/mapping.js';

const collect = (value, previous) => previous.concat([value]);

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const backupPathFor = (backup, instanceUuid) => {
  // commander sets backup === true when neither --backup <path> nor --no-backup is passed
  if (!backup || backup === true) return `dns-export-${instanceUuid}-${timestamp()}.json`;
  if (fs.existsSync(backup) && fs.statSync(backup).isDirectory()) return path.join(backup, `${instanceUuid}.json`);
  return backup;
};

const filterByDomains = (plans, domains) => {
  if (!domains.length) return plans;
  const wanted = new Set(domains.map(domain => domain.toLowerCase()));
  return plans.filter(plan => wanted.has((plan.domainName || '').toLowerCase()));
};

const exitCodeFor = (results) => {
  if (results.some(result => ['error', 'invalid', 'apply-failed'].includes(result.status))) return 1;
  if (results.some(result => result.status === 'blocked-destructive')) return 3;
  return 0;
};

// Export -> backup -> transform -> (apply -> cutover) for one source/target instance pair.
const migratePair = async ({ source, target, sourceUuid, targetUuid, sourceEnv, params, spinner, label }) => {
  spinner.start(`${label}: exporting from ${source.portalUrl}`);
  const { envelope } = await exportInstance({
    client: source.client,
    instanceUuid: sourceUuid,
    instanceUrl: source.instanceUrl,
    envName: sourceEnv
  });
  spinner.stop();

  if (params.backup !== false) {
    const outPath = backupPathFor(params.backup, sourceUuid);
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(envelope, null, 2));
    await logger.Info(`${label}: source export backed up to ${outPath}`, { hideTimestamp: true });
  }

  const { plans } = transformEnvelope(envelope, {
    targetInstanceUuid: targetUuid,
    dropValuePatterns: params.dropValue.map(pattern => new RegExp(pattern, 'i'))
  });
  const selected = filterByDomains(plans, params.domain);

  if (!params.json) {
    await logger.Info(`\n${renderPlans(selected)}\n\n${label}: ${renderSummary(selected)}`, { hideTimestamp: true });
  }

  const hasErrors = selected.some(plan => plan.errors.length);
  if (params.dryRun || hasErrors) {
    if (hasErrors && !params.dryRun) {
      await logger.Error(`${label}: fix the transform errors above (or exclude those domains with --domain) before migrating.`, { exit: false });
    }
    return { label, plans: selected, results: [], dryRun: true, hasErrors, targetStatuses: [] };
  }

  spinner.start(`${label}: applying to ${target.portalUrl}`);
  const { results } = await applyPlans({
    client: target.client,
    plans: selected,
    confirmDestructive: !!params.confirmDestructive,
    wait: params.wait,
    onProgress: (domain, status) => { spinner.text = `${label}: applying ${domain} (${status?.status || 'waiting'})`; }
  });
  spinner.stop();

  const targetStatuses = [];
  for (const result of results.filter(entry => entry.status === 'applied')) {
    targetStatuses.push(
      result.domainStatus ||
      await target.client.getDomain(result.domainName, targetUuid).catch(() => null)
    );
  }

  if (!params.json) {
    await logger.Info(`\n${renderResults(results)}`, { hideTimestamp: true });
    if (results.some(result => result.status === 'blocked-destructive')) {
      await logger.Warn(`${label}: some domains were blocked as destructive — re-run with --confirm-destructive to proceed.`);
    }
    const cutovers = targetStatuses.filter(Boolean);
    if (cutovers.length) await logger.Info(`\n${renderCutovers(cutovers)}`, { hideTimestamp: true });
  }

  return { label, plans: selected, results, dryRun: false, hasErrors: false, targetStatuses };
};

const bulkSummaryRow = (outcome) => {
  const counts = outcome.results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});
  return [
    `  ${outcome.label}`,
    String(outcome.plans.filter(plan => !plan.skipped).length),
    String(counts.applied || 0),
    String(counts['blocked-destructive'] || 0),
    String((counts.error || 0) + (counts.invalid || 0) + (outcome.hasErrors ? 1 : 0))
  ];
};

program.showHelpAfterError();
program
  .name('pos-cli dns migrate')
  .arguments('[sourceEnv]')
  .arguments('[targetEnv]')
  .option('--domain <name>', 'only migrate this domain (repeatable)', collect, [])
  .option('--drop-value <regex>', 'drop records whose value matches this pattern (repeatable)', collect, [])
  .option('--dry-run', 'export + plan only, write nothing to the target')
  .option('--confirm-destructive', 'allow updates that delete many managed records on the target')
  .option('--backup <path>', 'where to write the source export backup (file, or directory in bulk mode)')
  .option('--no-backup', 'skip writing the backup file')
  .option('--no-wait', 'do not poll provisioning status after applying')
  .option('--mapping-file <path>', 'bulk: CSV source_uuid,target_uuid[,label] or JSON array of pairs')
  .option('--instances-file <path>', 'bulk: source instance uuids (one per line), targets resolved by --match-by-domain')
  .option('--match-by-domain', 'bulk: resolve each target instance by the source customer domains')
  .option('--source-portal-url <url>').option('--source-token <token>').option('--source-email <email>').option('--source-instance-uuid <uuid>')
  .option('--target-portal-url <url>').option('--target-token <token>').option('--target-email <email>').option('--target-instance-uuid <uuid>')
  .option('--json', 'machine-readable output')
  .action(async (sourceEnv, targetEnv, params) => {
    const spinner = ora({ text: 'Migrating DNS', stream: process.stdout });
    try {
      const bulk = !!(params.mappingFile || params.instancesFile);
      if (params.instancesFile && !params.matchByDomain && !params.mappingFile) {
        await logger.Error('--instances-file needs --match-by-domain (or use --mapping-file with explicit target uuids).');
      }

      const source = await resolvePortalContext(sourceEnv, {
        portalUrl: params.sourcePortalUrl,
        token: params.sourceToken,
        email: params.sourceEmail,
        instanceUuid: params.sourceInstanceUuid,
        label: 'source',
        readOnly: true,
        skipInstanceLookup: bulk
      });
      const target = await resolvePortalContext(targetEnv, {
        portalUrl: params.targetPortalUrl,
        token: params.targetToken,
        email: params.targetEmail,
        instanceUuid: params.targetInstanceUuid,
        label: 'target',
        skipInstanceLookup: bulk
      });

      if (!bulk) {
        if (source.portalUrl === target.portalUrl && source.instanceUuid === target.instanceUuid) {
          await logger.Error('Source and target resolve to the same instance on the same portal — nothing to migrate.');
        }
        const outcome = await migratePair({
          source,
          target,
          sourceUuid: source.instanceUuid,
          targetUuid: target.instanceUuid,
          sourceEnv,
          params,
          spinner,
          label: source.instanceUuid
        });
        if (params.json) console.log(JSON.stringify({ plans: outcome.plans, results: outcome.results, target_domains: outcome.targetStatuses }, null, 2));
        process.exit(outcome.hasErrors ? 2 : exitCodeFor(outcome.results));
      }

      // Bulk cohort mode
      const pairs = params.mappingFile
        ? parseMappingFile(params.mappingFile)
        : await (async () => {
          const uuids = parseInstancesFile(params.instancesFile);
          const resolved = [];
          for (const sourceUuid of uuids) {
            spinner.start(`resolving target for ${sourceUuid}`);
            try {
              const targetUuid = await matchByDomain({ sourceClient: source.client, targetClient: target.client, sourceUuid });
              resolved.push({ sourceUuid, targetUuid, label: sourceUuid });
            } catch (error) {
              resolved.push({ sourceUuid, targetUuid: null, label: sourceUuid, resolveError: error.message });
            }
            spinner.stop();
          }
          return resolved;
        })();

      const outcomes = [];
      for (const pair of pairs) {
        if (!pair.targetUuid) {
          await logger.Warn(`${pair.label}: skipped — ${pair.resolveError}`);
          outcomes.push({ label: pair.label, plans: [], results: [{ domainName: '-', status: 'error', serverMessage: pair.resolveError }], hasErrors: true, targetStatuses: [] });
          continue;
        }
        try {
          outcomes.push(await migratePair({
            source,
            target,
            sourceUuid: pair.sourceUuid,
            targetUuid: pair.targetUuid,
            sourceEnv,
            params,
            spinner,
            label: pair.label
          }));
        } catch (error) {
          spinner.stop();
          await logger.Warn(`${pair.label}: failed — ${error.message}`);
          outcomes.push({ label: pair.label, plans: [], results: [{ domainName: '-', status: 'error', serverMessage: error.message }], hasErrors: true, targetStatuses: [] });
        }
      }

      const allResults = outcomes.flatMap(outcome => outcome.results);
      if (params.json) {
        console.log(JSON.stringify({ outcomes: outcomes.map(({ label, plans, results }) => ({ label, plans, results })) }, null, 2));
      } else {
        const header = ['  instance', 'domains', 'applied', 'blocked', 'errors'];
        await logger.Info(`\n${table([header, ...outcomes.map(bulkSummaryRow)])}`, { hideTimestamp: true });
      }
      const anyTransformErrors = outcomes.some(outcome => outcome.hasErrors);
      process.exit(anyTransformErrors ? 1 : exitCodeFor(allResults));
    } catch (error) {
      spinner.stop();
      logger.Error(error.message || error);
    }
  });

program.parse(process.argv);
