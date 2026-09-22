/**
 * deploy-dry-run's whole value is that it cannot deploy. These drive the handler through
 * `runTool`, the way both transports do, and assert what reached the API — not what the handler
 * returned about itself.
 */
import fs from 'fs';
import path from 'path';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { runTool } from '../run-tool.js';
import registry from '../tools.js';
import dryRunTool from '../deploy/dry-run.js';
import { DEPLOY_WORK_ROOT } from '../deploy/work-dir.js';

const AUTH = { url: 'https://dry.example.com', email: 'e@example.com', token: 'tok' };

let workDir;
let cwd;

/** A project with one deployable file, so makeArchive has something to put in the archive. */
const makeProject = () => {
  const dir = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'pos-cli-dry-run-'));
  fs.mkdirSync(path.join(dir, 'app', 'views', 'pages'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'app', 'views', 'pages', 'index.liquid'), 'hello\n');
  return dir;
};

/**
 * Records every call, and answers the shapes the API really sends: the push carries no report at
 * all (measured — it answers `ready_for_import` with `report: null`), and the file report and any
 * validation error appear on the release once it settles.
 */
const gatewayFake = ({ report = null, releaseStatus = 'success', error = null, assetStatuses = [] } = {}) => {
  const calls = { push: [], sendManifest: [], getStatus: [] };
  let assetIndex = 0;
  class Fake {
    constructor(auth) { calls.constructedWith = auth; }
    async push(formData) {
      // The stream keeps the temp directory busy if it is never read; recording the keys is enough.
      calls.push.push(Object.fromEntries(Object.entries(formData).map(([k, v]) => [k, typeof v === 'object' ? '<stream>' : v])));
      return { id: 'rel-1', status: 'ready_for_import' };
    }
    async sendManifest(manifest, releaseId) { calls.sendManifest.push({ manifest, releaseId }); return {}; }
    async getStatus(id) {
      calls.getStatus.push(id);
      const release = { status: releaseStatus, report, error };
      // The first poll settles the release; the asset script runs on the polls after it.
      if (calls.getStatus.length === 1) return release;
      return { ...release, ...(assetStatuses[Math.min(assetIndex++, assetStatuses.length - 1)] ?? {}) };
    }
  }
  return { Fake, calls };
};

/** Milliseconds, so the release and asset loops are decided rather than slept. */
const FAST = { pollIntervalMs: 5, phaseTimeoutMs: 500 };

beforeEach(() => {
  cwd = process.cwd();
  workDir = makeProject();
  process.chdir(workDir);
});

afterEach(() => {
  process.chdir(cwd);
  fs.rmSync(workDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('deploy-dry-run applies nothing', () => {
  test('every request it sends carries dry_run', async () => {
    const { Fake, calls } = gatewayFake({ report: { Liquid: { upserted: ['a.liquid'], deleted: ['gone.liquid'] } } });

    const result = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST });

    expect(result.ok, JSON.stringify(result.error)).toBe(true);
    expect(calls.push).toHaveLength(1);
    expect(calls.push[0]['marketplace_builder[dry_run]']).toBe('true');
    expect(result.data.applied).toBe(false);
  });

  // The guarantee is structural, not a branch: no argument may produce a request without dry_run.
  test.each([
    ['no arguments beyond credentials', {}],
    ['partial true', { partial: true }],
    ['partial false', { partial: false }],
    // Values the schema would reject, passed straight to the handler, so that a dispatch path that
    // ever skipped validation could not turn them into a real deploy.
    ['partial as a string', { partial: 'false' }],
    ['a dryRun:false someone hoped would work', { dryRun: false }],
    ['dry_run:false', { dry_run: false }]
  ])('%s still sends dry_run', async (_label, extra) => {
    const { Fake, calls } = gatewayFake({ report: {} });

    await runTool(dryRunTool, { ...AUTH, ...extra }, { Gateway: Fake, ...FAST });

    expect(calls.push).toHaveLength(1);
    expect(calls.push[0]['marketplace_builder[dry_run]']).toBe('true');
  });

  test('it never uploads assets, only validates the manifest', async () => {
    fs.mkdirSync(path.join(workDir, 'app', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(workDir, 'app', 'assets', 'app.css'), 'body{}');
    const { Fake, calls } = gatewayFake({
      report: {},
      assetStatuses: [{ asset_status: 'in_progress' }, { asset_report: { upserted: ['assets/app.css'], deleted: [] } }]
    });

    const result = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST });

    expect(result.ok).toBe(true);
    // The manifest is described to the API; the bytes never leave.
    expect(calls.sendManifest).toHaveLength(1);
    expect(calls.sendManifest[0].releaseId).toBe('rel-1');
    expect(result.data.assets.state).toBe('validated');
    expect(result.data.byCategory.Asset.upserted.count).toBe(1);
  });

  // The call context takes one named object and refuses anything else. This tool reported three
  // positional arguments for a release: they were read as that object, became NaN, and went out as
  // `progress: null` — after which every heartbeat for the call was null too.
  test('reports progress in the shape the call context takes', async () => {
    fs.mkdirSync(path.join(workDir, 'app', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(workDir, 'app', 'assets', 'app.css'), 'body{}');
    const { Fake } = gatewayFake({ report: {}, assetStatuses: [{ asset_report: { upserted: [], deleted: [] } }] });
    const sendProgress = vi.fn();

    await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, sendProgress, ...FAST });

    expect(sendProgress).toHaveBeenCalledTimes(1);
    const [report, ...extra] = sendProgress.mock.calls[0];
    expect(extra, 'sendProgress takes one named object').toEqual([]);
    expect(Number.isFinite(report.progress), `progress was ${report.progress}`).toBe(true);
    expect(Number.isFinite(report.total), `total was ${report.total}`).toBe(true);
  });

  test('the registry entry is the same tool, so the transports get this one', () => {
    expect(registry.get('deploy-dry-run')).toBe(dryRunTool);
  });
});

describe('what it reports', () => {
  test('separates what would be deleted from what would be added', async () => {
    const { Fake } = gatewayFake({
      report: {
        Liquid: { upserted: ['pages/a.liquid', 'pages/b.liquid'], deleted: ['pages/old.liquid'], skipped: [] },
        GraphQL: { upserted: [], deleted: ['queries/gone.graphql'], skipped: ['queries/same.graphql'] }
      }
    });

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST });

    expect(data.deleted.count).toBe(2);
    expect(data.deleted.files).toEqual(['pages/old.liquid', 'queries/gone.graphql']);
    expect(data.upserted.count).toBe(2);
    expect(data.skipped.count).toBe(1);
    // Per category too, so an agent can say which kind of file is going.
    expect(data.byCategory.GraphQL.deleted.files).toEqual(['queries/gone.graphql']);
  });

  // The API answers some categories with a count instead of the paths.
  test('a category that reports counts rather than paths still counts', async () => {
    const { Fake } = gatewayFake({ report: { Liquid: { upserted: 12, deleted: 3, skipped: 0 } } });

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST });

    expect(data.deleted.count).toBe(3);
    expect(data.deleted.files).toEqual([]);
    expect(data.upserted.count).toBe(12);
  });

  test('an asset phase that failed is reported as a failure, not as an absence', async () => {
    fs.mkdirSync(path.join(workDir, 'app', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(workDir, 'app', 'assets', 'app.css'), 'body{}');
    const { Fake } = gatewayFake({ report: {}, assetStatuses: [{ asset_error: { error: 'manifest rejected' } }] });

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST });

    expect(data.assets).toMatchObject({ state: 'failed', error: 'manifest rejected' });
  });

  // `none` is a claim about the project. A release with no id is a claim about the check.
  test('assets it could not check are not reported as assets it does not have', async () => {
    fs.mkdirSync(path.join(workDir, 'app', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(workDir, 'app', 'assets', 'app.css'), 'body{}');
    class NoReleaseId {
      async push() { return { status: 'dry_run', report: {} }; }
      async sendManifest() { throw new Error('must not be called without a release'); }
    }

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: NoReleaseId, ...FAST });

    expect(data.assets).toEqual({ state: 'not_reported', count: 1 });
  });

  test('a project with no assets says so rather than omitting them', async () => {
    const { Fake, calls } = gatewayFake({ report: {} });

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST });

    expect(data.assets).toEqual({ state: 'none', count: 0 });
    expect(calls.sendManifest).toHaveLength(0);
  });
});

describe('its failures', () => {
  test('a project with nothing deployable is a project error, not an empty report', async () => {
    const empty = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'pos-cli-dry-run-empty-'));
    process.chdir(empty);
    try {
      const { Fake, calls } = gatewayFake({ report: {} });

      const result = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST });

      expect(result.ok).toBe(false);
      expect(result.error.kind).toBe('project');
      expect(['NO_DIRECTORIES', 'EMPTY_ARCHIVE']).toContain(result.error.code);
      // Nothing was sent, which is the point: it failed before the API was involved.
      expect(calls.push).toHaveLength(0);
    } finally {
      process.chdir(workDir);
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  test('an instance that refuses the archive is reported as the instance refusing', async () => {
    class Refuses {
      async push() { throw Object.assign(new Error('Unprocessable'), { statusCode: 422 }); }
    }

    const result = await runTool(dryRunTool, { ...AUTH }, { Gateway: Refuses, ...FAST });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ kind: 'instance', details: { statusCode: 422 } });
  });
});

describe('its annotations', () => {
  // A dry run creates a release record and writes an archive, so it is not read-only — and
  // claiming to be would let a client run it without the confirmation it deserves.
  test('do not claim read-only, and do say it is not destructive', () => {
    expect(dryRunTool.annotations.readOnlyHint).toBeUndefined();
    expect(dryRunTool.annotations.destructiveHint).toBe(false);
  });

  test('deploy-start points at it, so the safe call is discoverable from the dangerous one', () => {
    expect(registry.get('deploy-start').description).toContain('deploy-dry-run');
  });

  test('it writes its own archive, never the one a real deploy is streaming', () => {
    const source = fs.readFileSync(new URL('../deploy/dry-run.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/['"]\.\/tmp\/release\.zip['"]/);
  });
});

/**
 * One fixed archive name was only ever safe against `deploy-start`, which uses a different one —
 * not against a second dry run. Each call gets its own directory, and does not leave it behind.
 */
describe('the archive directory a dry run writes into', () => {
  const leftBehind = () => {
    const root = path.join(workDir, DEPLOY_WORK_ROOT);
    return fs.existsSync(root) ? fs.readdirSync(root) : [];
  };

  test('is removed when the dry run answers', async () => {
    const { Fake } = gatewayFake({ report: { Liquid: { upserted: ['a.liquid'] } } });

    const result = await runTool(dryRunTool, AUTH, { Gateway: Fake, ...FAST });

    expect(result.ok).toBe(true);
    expect(result.data.archive).toEqual({ fileCount: 1 });
    expect(leftBehind()).toEqual([]);
  });

  // The archive is built inside it, so every way of failing afterwards has to remove it.
  test('is removed when there is nothing to archive', async () => {
    fs.rmSync(path.join(workDir, 'app', 'views'), { recursive: true, force: true });
    const { Fake, calls } = gatewayFake({});

    const result = await runTool(dryRunTool, AUTH, { Gateway: Fake, ...FAST });

    expect(result).toMatchObject({ ok: false, error: { code: 'EMPTY_ARCHIVE' } });
    expect(calls.push).toEqual([]);
    expect(leftBehind()).toEqual([]);
  });

  test('is removed when the instance refuses the push', async () => {
    class Fake {
      async push() { throw Object.assign(new Error('Request failed with status 422'), { statusCode: 422 }); }
    }

    const result = await runTool(dryRunTool, AUTH, { Gateway: Fake, ...FAST });

    expect(result.ok).toBe(false);
    expect(leftBehind()).toEqual([]);
  });
});

/**
 * The report is read off the settled release, not the push. Measured against a live instance: the
 * push answers `ready_for_import` with `report: null`, and the report — and any validation error —
 * appear a second or two later. Reading the push response gave every dry run `byCategory: {}`, so
 * the only thing left in it was the asset phase and the tool answered `deleted: 0` for deploys
 * that delete. An agent that ran the documented pre-flight check still destroyed files.
 */
describe('what the dry run reports', () => {
  test('names the files a non-partial deploy would delete', async () => {
    const { Fake } = gatewayFake({
      report: { Pages: { upserted: ['views/pages/new.liquid'], deleted: ['views/pages/doomed.liquid'] } }
    });

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST });

    expect(data.deleted).toEqual({ count: 1, files: ['views/pages/doomed.liquid'] });
    expect(data.byCategory.Pages.upserted.files).toEqual(['views/pages/new.liquid']);
    expect(data.verdict).toBe('would_succeed');
  });

  // The push response never carries one, so a tool that reads it there reports nothing at all.
  test('does not take the report from the push response', async () => {
    class PushCarriesAReport {
      async push() { return { id: 'rel-1', status: 'ready_for_import', report: { Pages: { deleted: ['ignored.liquid'] } } }; }
      async getStatus() { return { status: 'success', report: { Pages: { deleted: ['views/pages/real.liquid'] } } }; }
      async sendManifest() { return {}; }
    }

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: PushCarriesAReport, ...FAST });

    expect(data.deleted.files).toEqual(['views/pages/real.liquid']);
  });

  /**
   * The instance evaluates the deploy and can refuse it outright — a table with records still in
   * it cannot be dropped, for one. That verdict is the answer to the question this tool is asked,
   * and it used to be invisible: the tool never looked at the release.
   */
  test('a deploy the instance would refuse is reported as would_fail, with the files', async () => {
    const { Fake } = gatewayFake({
      releaseStatus: 'error',
      error: {
        error: 'Validation failed:\nschema/note.yml: cannot be deleted — 1 record(s) still exist.',
        details: [{ file: 'schema/note.yml', errors: ['cannot be deleted — 1 record(s) still exist.'] }]
      }
    });

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST });

    expect(data.verdict).toBe('would_fail');
    expect(data.error.message).toMatch(/cannot be deleted/);
    expect(data.error.files).toEqual([{ file: 'schema/note.yml', errors: ['cannot be deleted — 1 record(s) still exist.'] }]);
  });

  // Nothing to validate a manifest against, and waiting on one would spend the timeout to find out.
  test('a refused release does not then wait on the asset phase', async () => {
    const { Fake, calls } = gatewayFake({ releaseStatus: 'error', error: { error: 'nope' } });

    await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST });

    expect(calls.sendManifest).toEqual([]);
  });

  // An unfinished answer, not an error: the archive was built and the push accepted.
  test('a release that never settles is not_known rather than a guess', async () => {
    const { Fake } = gatewayFake({ releaseStatus: 'in_progress' });

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST });

    expect(data.verdict).toBe('not_known');
    expect(data.deleted).toEqual({ count: 0, files: [] });
  });

  test('a cancelled call stops polling the release', async () => {
    const controller = new AbortController();
    const { Fake, calls } = gatewayFake({ releaseStatus: 'in_progress' });

    const running = runTool(dryRunTool, { ...AUTH }, { Gateway: Fake, ...FAST, signal: controller.signal });
    await vi.waitFor(() => expect(calls.getStatus.length).toBeGreaterThan(0));
    controller.abort();

    expect(await running).toMatchObject({ ok: false, error: { kind: 'cancelled' } });
  });
});
