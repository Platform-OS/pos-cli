import { pathToFileURL } from 'url';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { describe, test, expect, beforeAll, afterEach, vi } from 'vitest';

/**
 * `autoFix` re-lints the whole project after applying fixes, which is correct but is the
 * most expensive thing this tool can do — a second whole-project pass. It must happen only
 * when a fix was actually WRITTEN.
 *
 * Counting `appCheckRun` calls is the assertion, because the observable result is identical
 * either way: on a project whose findings are all suggest-only, the wasted second pass
 * reproduces the same offenses, so nothing but the call count can tell you it happened.
 */
vi.mock('@platformos/platformos-check-node', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    appCheckRun: vi.fn(actual.appCheckRun),
    autofix: vi.fn(actual.autofix)
  };
});

const checkRunModPath = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'check', 'run.js')).href;

/** Whether the linter is installed at all — these tests are meaningless without it. */
let available = false;
let platformosCheck;
let checkRunTool;
const workspaces = [];

function makeApp(config, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-autofix-'));
  workspaces.push(root);
  fs.writeFileSync(path.join(root, '.platformos-check.yml'), config, 'utf8');
  for (const [relativePath, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(relativePath)), { recursive: true });
    fs.writeFileSync(path.join(root, relativePath), body, 'utf8');
  }
  return root;
}

/**
 * A finding with no `fix`. `MissingPartial` offers none — there is no safe edit for a name
 * that resolves to nothing.
 */
const SUGGEST_ONLY = {
  config: 'extends: platformos-check:nothing\nMissingPartial:\n  enabled: true\n',
  files: { 'app/views/pages/home.liquid': "{% render 'nope' %}" }
};

/**
 * A finding WITH a `fix`: a `{% doc %}` param declared required while the body supplies a
 * default, which `RequiredDocParamWithDefault` rewrites to `[profile]`.
 */
const FIXABLE = {
  config: 'extends: platformos-check:nothing\nRequiredDocParamWithDefault:\n  enabled: true\n',
  files: {
    'app/views/partials/card.liquid':
      '{% doc %}\n  @param {object} profile - the profile\n{% enddoc %}\n' +
      '{% liquid\n  assign profile = profile | default: 1\n%}\n{{ profile }}',
    'app/views/pages/home.liquid': "{% render 'card' %}"
  }
};

describe('platformos.check-run autoFix gating', () => {
  beforeAll(async () => {
    checkRunTool = (await import(checkRunModPath)).default;
    try {
      platformosCheck = await import('@platformos/platformos-check-node');
      available = typeof platformosCheck.appCheckRun === 'function';
    } catch {
      available = false;
    }
  });

  afterEach(() => {
    vi.mocked(platformosCheck?.appCheckRun)?.mockClear();
    vi.mocked(platformosCheck?.autofix)?.mockClear();
    while (workspaces.length) fs.rmSync(workspaces.pop(), { recursive: true, force: true });
  });

  test('skips the re-lint when no offense carries a fix', async () => {
    if (!available) return;
    const appPath = makeApp(SUGGEST_ONLY.config, SUGGEST_ONLY.files);

    const result = await checkRunTool.handler({ appPath, autoFix: true });

    // One offense found, nothing written, and — the point — ONE lint.
    expect(result.ok).toBe(true);
    expect(result.data.offenseCount).toBe(1);
    expect(result.data.autoFixed).toBe(false);
    expect(vi.mocked(platformosCheck.autofix)).not.toHaveBeenCalled();
    expect(vi.mocked(platformosCheck.appCheckRun)).toHaveBeenCalledTimes(1);
  });

  /**
   * The control. A gate wide enough to skip every re-lint would pass the test above and
   * silently report pre-fix offenses — stale positions, and findings the fix already
   * resolved — so the fixable case must still pay for the second pass.
   */
  test('still re-lints when an offense carries a fix', async () => {
    if (!available) return;
    const appPath = makeApp(FIXABLE.config, FIXABLE.files);

    const result = await checkRunTool.handler({ appPath, autoFix: true });

    expect(result.ok).toBe(true);
    expect(result.data.autoFixed).toBe(true);
    expect(vi.mocked(platformosCheck.autofix)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(platformosCheck.appCheckRun)).toHaveBeenCalledTimes(2);
    // The re-lint is what makes the fixed offense disappear from the report.
    expect(result.data.offenseCount).toBe(0);
    expect(fs.readFileSync(path.join(appPath, 'app/views/partials/card.liquid'), 'utf8')).toContain(
      '@param {object} [profile]'
    );
  });

  test('does not lint twice when autoFix was not requested', async () => {
    if (!available) return;
    const appPath = makeApp(FIXABLE.config, FIXABLE.files);

    const result = await checkRunTool.handler({ appPath });

    expect(result.ok).toBe(true);
    expect(result.data.offenseCount).toBe(1);
    expect(result.data.autoFixed).toBe(false);
    expect(vi.mocked(platformosCheck.appCheckRun)).toHaveBeenCalledTimes(1);
  });
});
