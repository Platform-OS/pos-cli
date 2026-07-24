#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import ora from 'ora';

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { resolvePortalContext } from '../lib/dns/auth.js';
import { exportInstance } from '../lib/dns/export.js';
import { transformEnvelope } from '../lib/dns/transform.js';
import { applyPlans } from '../lib/dns/apply.js';
import { renderPlans, renderSummary, renderResults } from '../lib/dns/plan.js';
import { renderCutovers } from '../lib/dns/cutover.js';
import { confirmApply } from '../lib/dns/guard.js';
import { collect, filterByDomains, backupPathFor, exitCodeForOutcomes } from '../lib/dns/cliHelpers.js';

// Export -> backup -> transform -> confirm -> (apply -> cutover) for one source/target
// instance pair. `confirm` is called after the plan is displayed; returning false aborts.
const migratePair = async ({ source, target, sourceUuid, targetUuid, sourceEnv, params, spinner, label, confirm }) => {
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

  if (confirm && !(await confirm())) {
    await logger.Info(`${label}: aborted — nothing was applied.`, { hideTimestamp: true });
    return { label, plans: selected, results: [], aborted: true, hasErrors: false, targetStatuses: [] };
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

program.showHelpAfterError();
program
  .name('pos-cli dns migrate')
  .arguments('[sourceEnv]')
  .arguments('[targetEnv]')
  .option('--domain <name>', 'only migrate this domain (repeatable)', collect, [])
  .option('--drop-value <regex>', 'drop records whose value matches this pattern (repeatable)', collect, [])
  .option('--dry-run', 'export + plan only, write nothing to the target')
  .option('-y, --yes', 'apply without the interactive confirmation (required in scripts/CI)')
  .option('--confirm-destructive', 'allow updates that delete many managed records on the target')
  .option('--unsafe-allow-protected-target', 'allow writing to a protected portal (partners.platformos.com is read-only by default)')
  .option('--backup <path>', 'where to write the source export backup (file or existing directory)')
  .option('--no-backup', 'skip writing the backup file')
  .option('--no-wait', 'do not poll provisioning status after applying')
  .option('--source-portal-url <url>').option('--source-token <token>').option('--source-email <email>').option('--source-instance-uuid <uuid>')
  .option('--target-portal-url <url>').option('--target-token <token>').option('--target-email <email>').option('--target-instance-uuid <uuid>')
  .option('--json', 'machine-readable output')
  .action(async (sourceEnv, targetEnv, params) => {
    const spinner = ora({ text: 'Migrating DNS', stream: process.stdout });
    try {
      const source = await resolvePortalContext(sourceEnv, {
        portalUrl: params.sourcePortalUrl,
        token: params.sourceToken,
        email: params.sourceEmail,
        instanceUuid: params.sourceInstanceUuid,
        label: 'source',
        readOnly: true
      });
      const target = await resolvePortalContext(targetEnv, {
        portalUrl: params.targetPortalUrl,
        token: params.targetToken,
        email: params.targetEmail,
        instanceUuid: params.targetInstanceUuid,
        label: 'target',
        allowProtectedTarget: !!params.unsafeAllowProtectedTarget
      });

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
        label: source.instanceUuid,
        confirm: () => confirmApply({ yes: !!params.yes, json: !!params.json, target: target.portalUrl })
      });
      if (params.json) console.log(JSON.stringify({ plans: outcome.plans, results: outcome.results, target_domains: outcome.targetStatuses }, null, 2));
      process.exit(exitCodeForOutcomes([outcome]));
    } catch (error) {
      spinner.stop();
      logger.Error(error.message || error);
    }
  });

program.parse(process.argv);
