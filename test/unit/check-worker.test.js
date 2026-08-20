import { Worker } from 'node:worker_threads';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test, expect, afterEach, vi } from 'vitest';

vi.setConfig({ testTimeout: 60000 });

/**
 * The worker's `-a` path, driven directly rather than through the CLI: it reports its stages
 * over `postMessage`, so whether the expensive post-fix re-lint happened is observable
 * without timing anything.
 *
 * That matters because the re-lint is invisible in the RESULT. On a project whose findings
 * are all suggest-only it reproduces the identical offense list, so only the absence of the
 * "Re-checking after fixes..." stage distinguishes "skipped it" from "paid for it twice".
 */
const RECHECK_STAGE = 'Re-checking after fixes...';

const workerUrl = new URL('../../lib/check-worker.js', import.meta.url);

const workspaces = [];

function makeApp(config, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-worker-'));
  workspaces.push(root);
  fs.writeFileSync(path.join(root, '.platformos-check.yml'), config, 'utf8');
  for (const [relativePath, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(relativePath)), { recursive: true });
    fs.writeFileSync(path.join(root, relativePath), body, 'utf8');
  }
  return root;
}

/** Run the worker to completion, keeping every stage message it posted. */
function runWorker({ path: checkPath, autoFix, checks }) {
  return new Promise((resolve, reject) => {
    const progress = [];
    const worker = new Worker(workerUrl, { workerData: { path: checkPath, autoFix, checks } });
    worker.on('message', (message) => {
      if (message.type === 'progress') progress.push(message.message);
      else if (message.type === 'result') resolve({ progress, offenses: message.offenses });
      else if (message.type === 'userError') reject(new Error(message.message));
    });
    worker.on('error', reject);
    worker.on('exit', () => reject(new Error('worker exited without posting a result')));
  });
}

/** `MissingPartial` offers no fix — there is no safe edit for a name that resolves to nothing. */
const SUGGEST_ONLY_CONFIG = 'extends: platformos-check:nothing\nMissingPartial:\n  enabled: true\n';

/**
 * `RequiredDocParamWithDefault` does offer one: it rewrites a `{% doc %}` param declared
 * required, whose body supplies a default, to the optional `[profile]` spelling.
 */
const FIXABLE_PARTIAL =
  '{% doc %}\n  @param {object} profile - the profile\n{% enddoc %}\n' +
  '{% liquid\n  assign profile = profile | default: 1\n%}\n{{ profile }}';

const BOTH_CONFIG =
  'extends: platformos-check:nothing\n' +
  'MissingPartial:\n  enabled: true\n' +
  'RequiredDocParamWithDefault:\n  enabled: true\n';

describe('check worker: the -a re-lint', () => {
  afterEach(() => {
    while (workspaces.length) fs.rmSync(workspaces.pop(), { recursive: true, force: true });
  });

  test('is skipped when no reported offense carries a fix', async () => {
    const appPath = makeApp(SUGGEST_ONLY_CONFIG, {
      'app/views/pages/home.liquid': "{% render 'nope' %}"
    });

    const { progress, offenses } = await runWorker({ path: appPath, autoFix: true });

    expect(offenses.map((o) => o.check)).toEqual(['MissingPartial']);
    expect(progress).not.toContain(RECHECK_STAGE);
  });

  /**
   * The control. A gate wide enough to skip every re-lint passes the test above while
   * reporting pre-fix offenses — stale positions, and findings the fix already resolved.
   */
  test('still runs, and resolves the offense, when one carries a fix', async () => {
    const appPath = makeApp('extends: platformos-check:nothing\nRequiredDocParamWithDefault:\n  enabled: true\n', {
      'app/views/partials/card.liquid': FIXABLE_PARTIAL,
      'app/views/pages/home.liquid': "{% render 'card' %}"
    });

    const { progress, offenses } = await runWorker({ path: appPath, autoFix: true });

    expect(progress).toContain(RECHECK_STAGE);
    expect(offenses).toEqual([]);
    expect(fs.readFileSync(path.join(appPath, 'app/views/partials/card.liquid'), 'utf8')).toContain(
      '@param {object} [profile]'
    );
  });

  test('does not run when -a was not passed', async () => {
    const appPath = makeApp('extends: platformos-check:nothing\nRequiredDocParamWithDefault:\n  enabled: true\n', {
      'app/views/partials/card.liquid': FIXABLE_PARTIAL,
      'app/views/pages/home.liquid': "{% render 'card' %}"
    });

    const { progress, offenses } = await runWorker({ path: appPath });

    expect(offenses.map((o) => o.check)).toEqual(['RequiredDocParamWithDefault']);
    expect(progress).not.toContain(RECHECK_STAGE);
  });

  /**
   * `--checks` narrows what the FIRST lint reports; the re-lint has to be narrowed the same
   * way. It was not, so `-a` combined with `--checks` reported every other check's offenses
   * once a fix had been applied — the one path where the two flags meet.
   */
  describe('with --checks', () => {
    const app = () =>
      makeApp(BOTH_CONFIG, {
        'app/views/partials/card.liquid': FIXABLE_PARTIAL,
        'app/views/pages/home.liquid': "{% render 'card' %}",
        'app/views/pages/other.liquid': "{% render 'nope' %}"
      });

    test('finds the unrelated offense when nothing narrows the run', async () => {
      // The control for the test below: `MissingPartial` IS reported here, and survives the
      // fix — so its absence there is `--checks` doing its job, not an empty project.
      const { progress, offenses } = await runWorker({ path: app(), autoFix: true });

      expect(progress).toContain(RECHECK_STAGE);
      expect(offenses.map((o) => o.check)).toEqual(['MissingPartial']);
    });

    test('reports only the named check after a fix has been applied', async () => {
      const { progress, offenses } = await runWorker({
        path: app(),
        autoFix: true,
        checks: ['RequiredDocParamWithDefault']
      });

      // The re-lint ran, the named check's offense was fixed, and the other check's
      // offense stays out of the report.
      expect(progress).toContain(RECHECK_STAGE);
      expect(offenses).toEqual([]);
    });
  });
});
