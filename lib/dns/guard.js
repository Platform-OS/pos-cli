import prompts from 'prompts';

// The legacy production portal is the migration SOURCE — dns commands must never
// write to it. Guards against argument swaps like `migrate <target> <source>`.
const PROTECTED_TARGET_HOSTS = ['partners.platformos.com'];

const assertWritablePortal = (portalUrl, { allowProtectedTarget = false } = {}) => {
  const host = new URL(portalUrl).hostname;
  if (!PROTECTED_TARGET_HOSTS.includes(host) || allowProtectedTarget) return;
  throw new Error(
    `${host} is protected as read-only for dns commands — it can be a migration source, ` +
    'never a target (did you swap the source and target arguments?). ' +
    'If you really intend to write to it, pass --unsafe-allow-protected-target.'
  );
};

// Plan-then-confirm gate: applying requires an explicit yes — interactively after
// the plan has been displayed, or via --yes in scripts/CI.
const confirmApply = async ({ yes = false, interactive = process.stdin.isTTY, target }) => {
  if (yes) return true;
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
