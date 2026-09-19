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
import { resolveAuth, runWithAuth } from '../auth.js';
import { ToolError } from '../tool-error.js';
import { cancelled, abortableDelay } from '../cancellation.js';
import files from '../../lib/files.js';
import Gateway from '../../lib/proxy.js';
import { makeArchive } from '../../lib/archive.js';
import { manifestGenerate } from '../../lib/assets/manifest.js';
import dir from '../../lib/directories.js';
import { authProperties } from '../schemas/auth.js';

// Its own path: `deploy-start` writes tmp/release.zip, and a dry run run beside a real deploy
// must not overwrite the archive that deploy is streaming.
const ARCHIVE_PATH = './tmp/release-dry-run.zip';

const ASSET_POLL_MS = 1000;
// The release report comes back with the upload; only the asset validation is polled. A minute is
// far more than the usual few seconds, and timing out is reported as an unfinished answer rather
// than an error, so the file report is never lost to a slow asset phase.
const ASSET_TIMEOUT_MS = 60_000;

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
const waitForAssets = async (gateway, releaseId, signal) => {
  const deadline = Date.now() + ASSET_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw cancelled();

    const { asset_report, asset_error, asset_status } = (await gateway.getStatus(releaseId)) || {};
    if (asset_report) return { state: 'validated', report: asset_report };
    if (asset_error) return { state: 'failed', error: asset_error.error ?? String(asset_error) };
    // An API that does not report on assets sends no status at all; there is nothing to wait for.
    if (asset_status !== 'in_progress') return { state: 'not_reported' };

    await abortableDelay(ASSET_POLL_MS, signal);
  }

  return { state: 'still_validating' };
};

const dryRunDeployTool = {
  description: 'Report what a deploy would add, update and delete on an instance, applying nothing. Run it before deploy-start: a deploy that is not partial deletes every file missing from the build, and this is the only way to see that list first.',
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

    if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true });

    const numberOfFiles = await makeArchive({ TARGET: ARCHIVE_PATH }, { withoutAssets: true });
    if (!numberOfFiles) {
      throw ToolError.project('EMPTY_ARCHIVE', 'No files to deploy. Archive would be empty.');
    }

    if (ctx.signal?.aborted) throw cancelled();

    // Absolute, and resolved now: a read stream opens lazily, so a relative path would be
    // resolved against whatever the working directory is by the time the request body is read.
    // Destroyed in `finally` because a push that throws never consumes it, and an unconsumed
    // stream holds its file descriptor until it is collected.
    const archiveStream = fs.createReadStream(path.resolve(ARCHIVE_PATH));
    // A read stream with no `error` listener raises an uncaught exception, which in a server is
    // the process rather than the call. The archive was just written and counted, so a failure to
    // read it is exceptional; the request it was feeding fails on its own and carries the outcome.
    archiveStream.on('error', (err) => log.debug('dry-run archive stream error', { error: String(err) }));
    let pushResponse;
    try {
      // `dry_run` is set here and nowhere else in this module, and no path omits it.
      pushResponse = await runWithAuth(auth, () => gateway.push({
        'marketplace_builder[partial_deploy]': String(partial),
        'marketplace_builder[dry_run]': 'true',
        'marketplace_builder[zip_file]': archiveStream
      }));
    } finally {
      archiveStream.destroy();
    }

    const releaseId = pushResponse?.id ?? null;
    const categories = Object.fromEntries(
      Object.entries(pushResponse?.report ?? {}).map(([name, data]) => [name, category(data)])
    );

    // The manifest is sent, never the files: the release is a dry run, so the API validates the
    // manifest against it instead of applying it, and nothing reaches S3.
    const assetFiles = await files.getAssets();
    let assets = { state: 'none', count: 0 };
    if (assetFiles.length > 0) {
      // `none` means the project has none. Without a release id there is nothing to validate a
      // manifest against, which is a different answer and has to read as one.
      assets = { state: 'not_reported', count: assetFiles.length };

      if (releaseId) {
        ctx.sendProgress?.({ progress: 1, total: 2, message: 'Validating assets' });
        const manifest = await manifestGenerate();
        await runWithAuth(auth, () => gateway.sendManifest(manifest, releaseId));

        // The report goes to `byCategory` with the rest of the file report, so it is read the same
        // way; what stays here is the verdict on the asset phase itself.
        const { report, ...outcome } = await waitForAssets(gateway, releaseId, ctx.signal);
        assets = { ...outcome, count: assetFiles.length };
        if (report) categories.Asset = category(report);
      }
    }

    return {
      applied: false,
      releaseId,
      partial,
      // The question an agent is asking, answered before the detail: a non-partial deploy deletes
      // everything missing from the build, and this is that list.
      deleted: { count: sumOver(categories, 'deleted'), files: Object.values(categories).flatMap(c => c.deleted.files) },
      upserted: { count: sumOver(categories, 'upserted'), files: Object.values(categories).flatMap(c => c.upserted.files) },
      skipped: { count: sumOver(categories, 'skipped'), files: Object.values(categories).flatMap(c => c.skipped.files) },
      byCategory: categories,
      assets,
      archive: { path: ARCHIVE_PATH, fileCount: numberOfFiles }
    };
  }
};

export default dryRunDeployTool;
