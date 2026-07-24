#!/usr/bin/env node

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { resolvePortalContext } from '../lib/dns/auth.js';
import { readEnvelope } from '../lib/dns/exportSchema.js';
import { transformEnvelope } from '../lib/dns/transform.js';
import { applyPlans, collectAppliedTargetStatuses } from '../lib/dns/apply.js';
import { renderPlans, renderSummary } from '../lib/dns/plan.js';
import { confirmApply } from '../lib/dns/guard.js';
import { collect, dropValuePatterns, filterByDomains, exitCodeFor, describeApplyTarget, portalFlags, reportApplyResults, reportError } from '../lib/dns/cliHelpers.js';

program.showHelpAfterError();
program
  .name('pos-cli dns import')
  .arguments('[environment]')
  .requiredOption('--file <path>', 'dns export file produced by pos-cli dns export')
  .option('--instance-uuid <uuid>', 'target instance uuid (skips lookup by the environment domain)')
  .option('--portal-url <url>', 'target Partner Portal url')
  .option('--token <token>', 'portal API token (overrides the environment token)')
  .option('--email <email>', 'authenticate with email + password prompt instead of a stored token')
  .option('--domain <name>', 'only import this domain (repeatable)', collect, [])
  .option('--drop-value <regex>', 'drop records whose value matches this pattern (repeatable)', collect, [])
  .option('--dry-run', 'print the transform plan without writing anything')
  .option('-y, --yes', 'apply without the interactive confirmation (required in scripts/CI)')
  .option('--confirm-destructive', 'allow updates that delete many managed records on the target')
  .option('--unsafe-allow-protected-target', 'allow writing to a protected portal (partners.platformos.com is read-only by default)')
  .option('--no-wait', 'do not poll provisioning status after applying')
  .option('--json', 'machine-readable output')
  .action(async (environment, params) => {
    try {
      const envelope = readEnvelope(params.file);

      // A dry-run with an explicit uuid needs no portal round-trip — the plan can be
      // reviewed before target-portal access even exists.
      const context = (params.dryRun && params.instanceUuid)
        ? { instanceUuid: params.instanceUuid, portalUrl: params.portalUrl || '(target portal)' }
        : await resolvePortalContext(environment, {
          ...portalFlags(params),
          label: 'target',
          allowProtectedTarget: !!params.unsafeAllowProtectedTarget
        });

      const { plans } = transformEnvelope(envelope, {
        targetInstanceUuid: context.instanceUuid,
        dropValuePatterns: dropValuePatterns(params.dropValue)
      });
      const selected = filterByDomains(plans, params.domain);

      if (!params.json) {
        await logger.Info(`Importing from ${envelope.portal_url} (exported ${envelope.exported_at}) into ${context.portalUrl}, instance ${context.instanceUuid}`, { hideTimestamp: true });
        await logger.Info(`\n${renderPlans(selected)}\n\n${renderSummary(selected)}`, { hideTimestamp: true });
      }

      const hasErrors = selected.some(plan => plan.errors.length);
      if (params.dryRun) {
        if (params.json) console.log(JSON.stringify({ plans: selected }, null, 2));
        process.exit(hasErrors ? 2 : 0);
      }
      if (hasErrors) {
        await logger.Error('Fix the transform errors above (or exclude those domains with --domain) before importing.', { exit: false });
        process.exit(2);
      }

      if (!(await confirmApply({ yes: !!params.yes, json: !!params.json, target: describeApplyTarget(context) }))) {
        await logger.Info('Aborted — nothing was applied.', { hideTimestamp: true });
        process.exit(0);
      }

      const { results } = await applyPlans({
        client: context.client,
        plans: selected,
        confirmDestructive: !!params.confirmDestructive,
        wait: params.wait
      });

      const targetStatuses = await collectAppliedTargetStatuses(context.client, context.instanceUuid, results);

      if (params.json) {
        console.log(JSON.stringify({ results, target_domains: targetStatuses }, null, 2));
      } else {
        await reportApplyResults({ results, targetStatuses });
      }

      process.exit(exitCodeFor(results));
    } catch (error) {
      await reportError(error);
    }
  });

program.parse(process.argv);
