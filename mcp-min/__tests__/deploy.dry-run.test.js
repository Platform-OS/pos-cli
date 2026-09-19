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

/** Records every call, and answers the shapes the API really sends. */
const gatewayFake = ({ report, assetStatuses = [] } = {}) => {
  const calls = { push: [], sendManifest: [], getStatus: [] };
  let statusIndex = 0;
  class Fake {
    constructor(auth) { calls.constructedWith = auth; }
    async push(formData) {
      // The stream keeps the temp directory busy if it is never read; recording the keys is enough.
      calls.push.push(Object.fromEntries(Object.entries(formData).map(([k, v]) => [k, typeof v === 'object' ? '<stream>' : v])));
      return { id: 'rel-1', status: 'dry_run', report };
    }
    async sendManifest(manifest, releaseId) { calls.sendManifest.push({ manifest, releaseId }); return {}; }
    async getStatus(id) {
      calls.getStatus.push(id);
      return assetStatuses[Math.min(statusIndex++, assetStatuses.length - 1)] ?? {};
    }
  }
  return { Fake, calls };
};

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

    const result = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake });

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

    await runTool(dryRunTool, { ...AUTH, ...extra }, { Gateway: Fake });

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

    const result = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake });

    expect(result.ok).toBe(true);
    // The manifest is described to the API; the bytes never leave.
    expect(calls.sendManifest).toHaveLength(1);
    expect(calls.sendManifest[0].releaseId).toBe('rel-1');
    expect(result.data.assets.state).toBe('validated');
    expect(result.data.byCategory.Asset.upserted.count).toBe(1);
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

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake });

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

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake });

    expect(data.deleted.count).toBe(3);
    expect(data.deleted.files).toEqual([]);
    expect(data.upserted.count).toBe(12);
  });

  test('an asset phase that failed is reported as a failure, not as an absence', async () => {
    fs.mkdirSync(path.join(workDir, 'app', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(workDir, 'app', 'assets', 'app.css'), 'body{}');
    const { Fake } = gatewayFake({ report: {}, assetStatuses: [{ asset_error: { error: 'manifest rejected' } }] });

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake });

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

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: NoReleaseId });

    expect(data.assets).toEqual({ state: 'not_reported', count: 1 });
  });

  test('a project with no assets says so rather than omitting them', async () => {
    const { Fake, calls } = gatewayFake({ report: {} });

    const { data } = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake });

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

      const result = await runTool(dryRunTool, { ...AUTH }, { Gateway: Fake });

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

    const result = await runTool(dryRunTool, { ...AUTH }, { Gateway: Refuses });

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
