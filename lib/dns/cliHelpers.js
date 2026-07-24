import fs from 'fs';
import path from 'path';

// Shared helpers for the dns bin files (repo convention: thin bins, logic in lib/).

const collect = (value, previous) => previous.concat([value]);

const filterByDomains = (plans, domains) => {
  if (!domains.length) return plans;
  const wanted = new Set(domains.map(domain => domain.toLowerCase()));
  return plans.filter(plan => wanted.has((plan.domainName || '').toLowerCase()));
};

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

// Where a source-export backup lands: a file path, an existing directory, or absent
// (default timestamped name). commander sets the value to `true` when --backup/--no-backup
// are defined but not passed.
const backupPathFor = (backup, instanceUuid) => {
  if (!backup || backup === true) return `dns-export-${instanceUuid}-${timestamp()}.json`;
  if (fs.existsSync(backup) && fs.statSync(backup).isDirectory()) return path.join(backup, `${instanceUuid}.json`);
  return backup;
};

// Exit-code contract for import/migrate (documented in the README dns section):
// 0 success, 1 apply errors/invalid plans, 2 transform errors, 3 only-destructive-blocked.
const exitCodeFor = (results) => {
  if (results.some(result => ['error', 'invalid', 'apply-failed'].includes(result.status))) return 1;
  if (results.some(result => result.status === 'blocked-destructive')) return 3;
  return 0;
};

// Outcome-level variant: folds per-pair transform errors (exit 2) into the contract;
// worst code wins when conditions are mixed (1 > 2 > 3).
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

const hostnameOf = (url, what = 'url') => {
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error(`Invalid ${what} "${url}" — it must include the scheme, e.g. https://${url}`);
  }
};

export { collect, filterByDomains, backupPathFor, exitCodeFor, exitCodeForOutcomes, hostnameOf, timestamp };
