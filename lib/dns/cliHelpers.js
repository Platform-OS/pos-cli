import fs from 'fs';
import path from 'path';

import logger from '../logger.js';
import ServerError from '../ServerError.js';
import { LEVEL_TOTALS_KEY, emptyTotals } from './compare.js';
import { renderResults } from './plan.js';
import { renderCutovers } from './cutover.js';

// Shared helpers for the dns bin files (repo convention: thin bins, logic in lib/).

const collect = (value, previous) => previous.concat([value]);

// --drop-value flags compile to case-insensitive regexes. All commands must compile
// them identically, or compare's "pass the same patterns the migration dropped"
// contract (TASK-1.11) silently stops matching.
const dropValuePatterns = (values) => values.map(pattern => new RegExp(pattern, 'i'));

const filterByDomains = (items, domains, getName = (item) => item.domainName) => {
  if (!domains.length) return items;
  const wanted = new Set(domains.map(domain => domain.toLowerCase()));
  return items.filter(item => wanted.has((getName(item) || '').toLowerCase()));
};

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

// Resolve the ONE shared bulk backup directory for a whole `dns migrate` cohort run,
// computed once before the per-pair loop. Calling backupPathFor(undefined, uuid, {bulk:true})
// directly per pair instead would mint a fresh timestamp on every call (each pair's export
// takes long enough for the clock to tick), scattering one backup per directory instead of
// sharing a single cohort directory the way dns export's bulk mode already does (TASK-1.18).
const resolveBulkBackupDir = (backup) => {
  if (backup === false) return false;
  return (!backup || backup === true) ? `dns-backups-${timestamp()}` : backup;
};

// Where a source-export backup lands. In bulk mode --backup is ALWAYS a directory
// (one file per source instance, whether or not the directory exists yet — TASK-1.10);
// in single mode it may be a file path, an existing directory, or absent (default name).
// commander sets the value to `true` when --backup/--no-backup are defined but not passed.
const backupPathFor = (backup, instanceUuid, { bulk = false } = {}) => {
  if (bulk) {
    return path.join(resolveBulkBackupDir(backup), `${instanceUuid}.json`);
  }
  if (!backup || backup === true) return `dns-export-${instanceUuid}-${timestamp()}.json`;
  if (fs.existsSync(backup) && fs.statSync(backup).isDirectory()) return path.join(backup, `${instanceUuid}.json`);
  return backup;
};

// One export/backup write convention for every dns command: parents created, pretty JSON.
const writeEnvelope = (outPath, envelope) => {
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(envelope, null, 2));
};

// Bulk migrate's per-instance summary counts, including domains whose apply POST was
// accepted but the async provisioning worker later failed (status 'apply-failed') — those
// must count as failures, not disappear from every column (TASK-1.19).
const summarizeBulkOutcome = (outcome) => {
  const counts = outcome.results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});
  return {
    domains: outcome.plans.filter(plan => !plan.skipped).length,
    applied: counts.applied || 0,
    blocked: counts['blocked-destructive'] || 0,
    errors: (counts.error || 0) + (counts.invalid || 0) + (counts['apply-failed'] || 0) + (outcome.hasErrors ? 1 : 0)
  };
};

// Exit-code contract for import/migrate (documented in the README dns section):
// 0 success, 1 apply errors/invalid plans, 2 transform errors, 3 only-destructive-blocked.
const exitCodeFor = (results) => {
  if (results.some(result => ['error', 'invalid', 'apply-failed'].includes(result.status))) return 1;
  if (results.some(result => result.status === 'blocked-destructive')) return 3;
  return 0;
};

// Bulk variant: the same condition must yield the same code as single-pair mode.
const exitCodeForOutcomes = (outcomes) => {
  const codes = outcomes.map(outcome => {
    const resultCode = exitCodeFor(outcome.results || []);
    if (resultCode === 1) return 1;
    if (outcome.hasErrors) return 2;
    return resultCode;
  });
  if (codes.includes(1)) return 1;
  if (codes.includes(2)) return 2;
  if (codes.includes(3)) return 3;
  return 0;
};

// Re-derive totals after filtering a compareInstance outcome by domain name — shared by
// dns compare's single-pair and bulk (--mapping-file) modes so --domain scopes both (TASK-1.17).
const filterOutcomeByDomain = (outcome, domainNames) => {
  if (!domainNames || !domainNames.length) return outcome;
  const results = filterByDomains(outcome.results, domainNames);
  const totals = results.reduce((acc, result) => {
    acc[LEVEL_TOTALS_KEY[result.level]] += 1;
    return acc;
  }, emptyTotals());
  return { results, totals };
};

// Shared top-level catch-block handler for all 5 dns bin files: network failures get the
// same friendly, host-naming messaging the rest of the CLI uses (lib/ServerError.js);
// everything else (typed portal errors, transform errors, etc.) falls back to the plain message.
const reportError = async (error) => {
  if (ServerError.isNetworkError(error)) {
    await ServerError.handler(error);
    // Only reached when the handler didn't exit itself: its unrecognized-network-code
    // and unrecognized-422-body paths log with { exit: false } (the latter sometimes
    // nothing at all). Restate the raw error so the failure is never silent.
    await logger.Error(error.message || String(error), { exit: false, notify: false, hideTimestamp: true });
  } else {
    await logger.Error(error.message || error, { exit: false });
  }
  // The documented dns exit-code contract (0 = success) requires a non-zero exit for
  // ANY failure that reaches this handler — never fall through to a success exit.
  process.exit(1);
};

// What to show in the plan-then-confirm prompt (lib/dns/guard.js's confirmApply). The portal
// URL alone doesn't distinguish between instances on the same private-stack portal — a user
// with several instances behind one portal would see an identical confirmation regardless of
// which one is about to be written to. Prefer the actual instance/site URL when we have it.
const describeApplyTarget = (context) => {
  const instance = context.instanceUrl || `instance ${context.instanceUuid}`;
  return `${instance} (${context.portalUrl})`;
};

// One side's portal flags for resolvePortalContext: prefixed (--source-*/--target-*) for
// the two-portal commands, unprefixed otherwise. Owns `interactive`: a password prompt
// writes to stdout, so --json runs must never prompt (mirrors guard.js's confirmApply).
const portalFlags = (params, side) => {
  const flags = side
    ? { portalUrl: params[`${side}PortalUrl`], token: params[`${side}Token`], email: params[`${side}Email`], instanceUuid: params[`${side}InstanceUuid`], label: side }
    : { portalUrl: params.portalUrl, token: params.token, email: params.email, instanceUuid: params.instanceUuid };
  return { ...flags, interactive: !params.json };
};

// Post-apply report shared by dns migrate and dns import: results table, destructive-block
// hint, cutover instructions. `label` prefixes the hint in bulk runs.
const reportApplyResults = async ({ results, targetStatuses, label }) => {
  await logger.Info(`\n${renderResults(results)}`, { hideTimestamp: true });
  if (results.some(result => result.status === 'blocked-destructive')) {
    const prefix = label ? `${label}: ` : '';
    await logger.Warn(`${prefix}some domains were blocked as destructive — re-run with --confirm-destructive to proceed.`);
  }
  const cutovers = targetStatuses.filter(Boolean);
  if (cutovers.length) await logger.Info(`\n${renderCutovers(cutovers)}`, { hideTimestamp: true });
};

const hostnameOf = (url, what = 'url') => {
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error(`Invalid ${what} "${url}" — it must include the scheme, e.g. https://${url}`);
  }
};

export {
  collect,
  dropValuePatterns,
  filterByDomains,
  filterOutcomeByDomain,
  backupPathFor,
  resolveBulkBackupDir,
  writeEnvelope,
  summarizeBulkOutcome,
  exitCodeFor,
  exitCodeForOutcomes,
  describeApplyTarget,
  portalFlags,
  reportApplyResults,
  hostnameOf,
  reportError,
  timestamp
};
