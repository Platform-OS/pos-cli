import prompts from 'prompts';

import { hostnameOf } from './cliHelpers.js';

// The legacy production portal is the migration SOURCE — dns commands must never
// write to it. Guards against argument swaps like `migrate <target> <source>`.
const PROTECTED_TARGET_HOSTS = ['partners.platformos.com'];

const assertWritablePortal = (portalUrl, { allowProtectedTarget = false } = {}) => {
  const host = hostnameOf(portalUrl, 'portal url');
  if (!PROTECTED_TARGET_HOSTS.includes(host) || allowProtectedTarget) return;
  throw new Error(
    `${host} is protected as read-only for dns commands — it can be a migration source, ` +
    'never a target (did you swap the source and target arguments?). ' +
    'If you really intend to write to it, pass --unsafe-allow-protected-target.'
  );
};

// Plan-then-confirm gate: applying requires an explicit yes — interactively after
// the plan has been displayed, or via --yes in scripts/CI.
const confirmApply = async ({ yes = false, interactive = process.stdin.isTTY, json = false, target }) => {
  if (yes) return true;
  if (json) {
    // --json suppresses the human-readable plan, so an interactive prompt would be
    // a blind confirmation — refuse instead (TASK-1.12).
    throw new Error(
      'With --json there is no plan review to confirm — pass --yes to apply, or --dry-run to preview the plan as JSON.'
    );
  }
  if (!interactive) {
    throw new Error(
      'Refusing to apply without confirmation in non-interactive mode — re-run with --yes, or use --dry-run to only preview.'
    );
  }
  const response = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: `Apply these DNS changes to ${target}?`,
    initial: false
  });
  return !!response.confirmed;
};

export { assertWritablePortal, confirmApply, PROTECTED_TARGET_HOSTS };
