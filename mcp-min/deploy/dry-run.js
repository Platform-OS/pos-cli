/**
 * deploy-dry-run — what a deploy would change, without changing it.
 *
 * A SEPARATE TOOL rather than a `dryRun` flag on `deploy-start`, decided deliberately (TASK-25 #4):
 *
 *  - A flag puts the destructive path one boolean away from the safe one. The whole point of this
 *    call is to be reached by an agent that does not yet know what a deploy would do, and
 *    `dryRun: false` — or omitting it — is then a full deploy. Here no argument applies anything:
 *    the request always carries `dry_run`, and there is no branch that does not.
 *  - The two have different lifecycles. `deploy-start` mints a `job_id` and starts a background S3
 *    upload that outlives the call; a dry run must do neither. One handler carrying both is the
 *    shape that hid the failed-migration bug — a single path whose meaning depended on a flag.
 *  - Annotations are per tool. `deploy-start` is `destructiveHint: true` and a client may gate it
 *    behind a prompt; gating the dry run the same way would defeat it.
 *
 * `destructiveHint: false` and NOT `readOnlyHint`: nothing on the instance is created, updated or
 * deleted, but the call is not free of effects — the API records a release, and the archive is
 * written under tmp/. Claiming read-only would overstate it, and MCP reads a missing
 * `readOnlyHint` as "may change things", which is the honest default.
 */
import fs from 'fs';
import path from 'path';
import log from '../log.js';
import { resolveAuth } from '../auth.js';
import { ToolError } from '../tool-error.js';
import { cancelled, abortableDelay } from '../cancellation.js';
import files from '../../lib/files.js';
import Gateway from '../../lib/proxy.js';
import { makeArchive } from '../../lib/archive.js';
import { manifestGenerate } from '../../lib/assets/manifest.js';
import dir from '../../lib/directories.js';
import { authProperties } from '../schemas/auth.js';
import { releaseState } from '../jobs/adapters/deploy.js';
import { makeWorkDir, removeWorkDir } from './work-dir.js';

const POLL_MS = 1000;
// Both phases are validation only — no import, no S3 — and settle in a second or two. A minute is
// far more than that, and timing out is reported as an unfinished answer rather than an error, so
// what did come back is never lost to a slow phase.
const PHASE_TIMEOUT_MS = 60_000;

/** Seams, as `job-status` has: tests drive the loops rather than sleep them. */
const timing = (ctx) => ({
  pollMs: ctx.pollIntervalMs ?? POLL_MS,
  timeoutMs: ctx.phaseTimeoutMs ?? PHASE_TIMEOUT_MS
});

const toList = (value) => (Array.isArray(value) ? value : []);
const toCount = (value) => (Array.isArray(value) ? value.length : (typeof value === 'number' ? value : 0));

/**
 * The API answers a category with either the file paths or just a count, so both are reported and
 * `count` is always right even when `files` is empty. An agent branches on `count`; `files` is
 * what it shows a person.
 */
const category = (data) => ({
  upserted: { count: toCount(data?.upserted), files: toList(data?.upserted) },
  deleted: { count: toCount(data?.deleted), files: toList(data?.deleted) },
  skipped: { count: toCount(data?.skipped), files: toList(data?.skipped) }
});

const sumOver = (categories, key) => Object.values(categories).reduce((n, c) => n + c[key].count, 0);

/**
 * Polls for the asset phase's verdict. `waitForAssetReport` in lib/ does this for the CLI, but it
 * cannot be reused here: it ignores an abort signal, waits ten minutes by default, and answers
 * `null` both for "no assets to report on" and "the asset phase failed" — a distinction this tool
 * has to keep, or a failure is reported as an absence.
 */
const waitForAssets = async (gateway, releaseId, signal, { pollMs, timeoutMs }) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw cancelled();

    const { asset_report, asset_error, asset_status } = (await gateway.getStatus(releaseId)) || {};
    if (asset_report) return { state: 'validated', report: asset_report };
    if (asset_error) return { state: 'failed', error: asset_error.error ?? String(asset_error) };
    // An API that does not report on assets sends no status at all; there is nothing to wait for.
    if (asset_status !== 'in_progress') return { state: 'not_reported' };

    await abortableDelay(pollMs, signal);
  }

  return { state: 'still_validating' };
};

/**
 * The file report exists only once the release has settled: the push answers `ready_for_import`
 * with `report: null`, and the report — and any validation error — appear on the release a second
 * or two later. Reading it off the push response gave every dry run an empty report, so the tool
 * answered `deleted: 0` for deploys that delete, and said nothing at all about a deploy the
 * instance had already rejected.
 */
const waitForRelease = async (gateway, releaseId, signal, { pollMs, timeoutMs }) => {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    if (signal?.aborted) throw cancelled();

    const release = (await gateway.getStatus(releaseId)) || {};
    // No status is not a settled release; `releaseState` would read it as finished.
    const state = release.status === undefined ? 'running' : releaseState(release.status);
    if (state !== 'running') return { state, release };
    if (Date.now() + pollMs > deadline) return { state: 'running', release };

    await abortableDelay(pollMs, signal);
  }
};

/** What the instance refused, per file where it said. */
const validationError = (release) => {
  const body = release?.error ?? {};
  return {
    message: body.error || 'the instance rejected this deploy',
    ...(Array.isArray(body.details) && { files: body.details })
  };
};

const dryRunDeployTool = {
  description: 'Report what a deploy would add, update and delete on an instance, applying nothing. Run it before deploy-start: a deploy that is not partial deletes every file missing from the build, and this is the only way to see that list first. verdict says whether the deploy would succeed at all; would_fail means deploy-start would be refused too, and error names the files.',
  annotations: { destructiveHint: false },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      partial: { type: 'boolean', description: 'Report the deploy that leaves missing files in place.', default: false }
    }
  },
  handler: async (params, ctx = {}) => {
    const partial = !!params?.partial;
    log.debug('tool:deploy-dry-run invoked', { env: params?.env, partial });

    const auth = await resolveAuth(params, ctx);
    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

    const availableDirs = dir.available();
    if (availableDirs.length === 0) {
      throw ToolError.project('NO_DIRECTORIES', `No deployable directories found. Need at least one of: ${dir.ALLOWED.join(', ')}`);
    }

    // Its own directory per call: one fixed name was safe against `deploy-start`, which uses a
    // different one, and not against a second dry run.
    const workDir = makeWorkDir('dry-run');
    const archivePath = path.join(workDir, 'release.zip');

    // Nothing after the push looks at the directory again — the manifest is generated from the
    // project's own assets — so it goes here, on every path out.
    let numberOfFiles;
    let pushResponse;
    try {
      numberOfFiles = await makeArchive({ TARGET: archivePath }, { withoutAssets: true });
      if (!numberOfFiles) {
        throw ToolError.project('EMPTY_ARCHIVE', 'No files to deploy. Archive would be empty.');
      }

      if (ctx.signal?.aborted) throw cancelled();

      // Absolute because that path, not the stream, is what gets read: `buildFormData`
      // (lib/apiRequest.js) sees `.path` and reads the file itself. The stream is never consumed,
      // so it is destroyed to close the descriptor; its `error` listener is not optional, since a
      // read stream without one raises an uncaught exception — in a server, the process.
      const archiveStream = fs.createReadStream(path.resolve(archivePath));
      archiveStream.on('error', (err) => log.debug('dry-run archive stream error', { error: String(err) }));
      try {
        // `dry_run` is set here and nowhere else in this module, and no path omits it.
        pushResponse = await gateway.push({
          'marketplace_builder[partial_deploy]': String(partial),
          'marketplace_builder[dry_run]': 'true',
          'marketplace_builder[zip_file]': archiveStream
        });
      } finally {
        // Before the directory goes: Windows will not remove a file with a handle still open.
        archiveStream.destroy();
      }
    } finally {
      removeWorkDir(workDir);
    }

    const releaseId = pushResponse?.id ?? null;
    let categories = {};
    // `would_fail` is the answer to the question this tool is asked, not a failure of the call, so
    // it travels in the result — where the description tells the agent to read it.
    let verdict = 'not_known';
    let error;

    const clock = timing(ctx);

    if (releaseId) {
      const { state, release } = await waitForRelease(gateway, releaseId, ctx.signal, clock);
      categories = Object.fromEntries(
        Object.entries(release.report ?? {}).map(([name, data]) => [name, category(data)])
      );
      if (state === 'done') verdict = 'would_succeed';
      if (state === 'failed') {
        verdict = 'would_fail';
        error = validationError(release);
      }
    }

    // The manifest is sent, never the files: the release is a dry run, so the API validates the
    // manifest against it instead of applying it, and nothing reaches S3.
    const assetFiles = await files.getAssets();
    let assets = { state: 'none', count: 0 };
    // A release the instance has already rejected has nothing for a manifest to be validated
    // against, and waiting on one would spend a minute to learn that.
    if (assetFiles.length > 0 && verdict !== 'would_fail') {
      // `none` means the project has none. Without a release id there is nothing to validate a
      // manifest against, which is a different answer and has to read as one.
      assets = { state: 'not_reported', count: assetFiles.length };

      if (releaseId) {
        ctx.sendProgress?.({ progress: 1, total: 2, message: 'Validating assets' });
        const manifest = await manifestGenerate();
        await gateway.sendManifest(manifest, releaseId);

        // The report goes to `byCategory` with the rest of the file report, so it is read the same
        // way; what stays here is the verdict on the asset phase itself.
        const { report, ...outcome } = await waitForAssets(gateway, releaseId, ctx.signal, clock);
        assets = { ...outcome, count: assetFiles.length };
        if (report) categories.Asset = category(report);
      }
    }

    return {
      applied: false,
      releaseId,
      partial,
      // The verdict before the detail: `would_fail` means deploy-start would not succeed either,
      // and `error` says which files the instance refused.
      verdict,
      ...(error && { error }),
      // The question an agent is asking, answered before the detail: a non-partial deploy deletes
      // everything missing from the build, and this is that list.
      deleted: { count: sumOver(categories, 'deleted'), files: Object.values(categories).flatMap(c => c.deleted.files) },
      upserted: { count: sumOver(categories, 'upserted'), files: Object.values(categories).flatMap(c => c.upserted.files) },
      skipped: { count: sumOver(categories, 'skipped'), files: Object.values(categories).flatMap(c => c.skipped.files) },
      byCategory: categories,
      assets,
      // No path: the archive is already removed by here.
      archive: { fileCount: numberOfFiles }
    };
  }
};

export default dryRunDeployTool;
