/**
 * deploy-dry-run — what a deploy would change, without changing it.
 *
 * A separate tool, not a `dryRun` flag on `deploy-start`: a flag leaves the destructive path one
 * boolean away from the safe one, for a call whose whole purpose is to be reached by an agent that
 * does not yet know what a deploy would do. Here no argument applies anything. The two also differ
 * in lifecycle — `deploy-start` mints a `job_id` and starts a background upload that outlives the
 * call — and in annotations, which are per tool.
 *
 * `destructiveHint: false` and deliberately NOT `readOnlyHint`: nothing on the instance is created,
 * updated or deleted, but a release record is written, one id per preview, and an archive lands
 * under tmp/.
 *
 * That record is kept on purpose and stamped `options.dry_run: "true"` (a real deploy's is null,
 * measured 2026-09-23), so nothing here tries to clean one up.
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
import { releaseState, filesNotMatched, warningsExceptDiscarded, toCount } from '../jobs/adapters/deploy.js';
import { makeWorkDir, removeWorkDir } from './work-dir.js';
import { partialProperty, partialOf } from './partial.js';

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

/**
 * The API answers a category with either the file paths or just a count, so both are kept and
 * `count` is right even when `files` is empty — `Asset` and `Translations` are counted-only, and
 * a count with no names is the platform's answer rather than a gap here.
 */
const category = (data) => ({
  upserted: { count: toCount(data?.upserted), files: toList(data?.upserted) },
  deleted: { count: toCount(data?.deleted), files: toList(data?.deleted) },
  skipped: { count: toCount(data?.skipped), files: toList(data?.skipped) }
});

/**
 * Categories whose deletion takes data with it rather than code.
 *
 * Measured 2026-09-23: the converter files `app/schema/*.yml` under `Tables`, and dropping a table
 * drops the records in it — which are not in the archive and no second deploy puts back. In the
 * flat `deleted` list a schema looks exactly like a partial, so an evaluation read a table going
 * and a page going as the same kind of line.
 *
 * A category this does not name is not flagged: the key is the converter's, so an unrecognised one
 * stays silent rather than guessing about data.
 */
const DESTROYS_DATA = new Set(['Tables']);

/**
 * The same judgement `DESTROYS_DATA` makes, made from a path because a refused release has no
 * report to read it off. The converter files `schema/*.yml` under `Tables` — measured 2026-09-29,
 * a dry run reported `schema/t62_items.yml` there — and dropping a table drops the records in it.
 */
const TABLE_FILE = /(^|\/)schema\/[^/]+\.ya?ml$/;

/**
 * Whether a path the instance named is still in this project. This is the half that stops the
 * flag crying wolf.
 *
 * A non-partial deploy deletes what the build does not have, so a refused table the project no
 * longer holds is a deletion the instance blocked — while a refused table the project *does* hold
 * is a file being imported, and costs no records. Measured 2026-09-29 against a live instance: a
 * malformed `schema/t62_broken.yml` is refused with the same `would_fail` and the same
 * `error.files` shape as two module tables holding thirteen records between them.
 *
 * A report path drops the deploy directory for app files (`schema/x.yml`) and keeps it for module
 * ones (`modules/<name>/public/schema/x.yml`), so both spellings are tried. A path that resolves
 * outside the project is not one of ours to go looking for.
 */
const inProject = (reported) => [reported, ...dir.available().map(d => path.join(d, reported))]
  .some((candidate) => {
    const full = path.resolve(candidate);
    return full.startsWith(process.cwd() + path.sep) && fs.existsSync(full);
  });

/**
 * The files a refused deploy is blocked on that can only be cleared by deleting records.
 *
 * Read off `error.files` — the per-file details the instance sends — and never off its message.
 * That message ends with a `records_delete_all` mutation, and `graphql-exec` is on the same
 * surface and will run it; pattern-matching prose to find that out would make the warning depend
 * on wording the platform is free to change.
 */
const dataLossBlockers = (error) => (error?.files ?? [])
  .map(entry => entry?.file)
  .filter(file => typeof file === 'string' && TABLE_FILE.test(file) && !inProject(file));

/** The deletions that cost records, by category, when there are any. */
const dataLossIn = (categories) => Object.entries(categories)
  .filter(([name]) => DESTROYS_DATA.has(name))
  .flatMap(([, c]) => c.deleted.files);

const sumOver = (categories, key) => Object.values(categories).reduce((n, c) => n + c[key].count, 0);

const flat = (categories, key) => ({
  count: sumOver(categories, key),
  files: Object.values(categories).flatMap(c => c[key].files)
});

/** The per-category breakdown, as counts: the names are already in the lists above, once. */
const countsByCategory = (categories) => Object.fromEntries(
  Object.entries(categories).map(([name, c]) => [name, { upserted: c.upserted.count, deleted: c.deleted.count, skipped: c.skipped.count }])
);

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

/**
 * Whether the instance worked out what the deploy would change. Measured 2026-09-25: a release it
 * rejects answers `status: "error"` with `report: null`, and a release that has not settled has
 * none yet either — so an absent report is "not computed", never "nothing would change".
 */
const hasReport = (release) => {
  const report = release?.report;
  return report !== null && typeof report === 'object' && !Array.isArray(report);
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
  description: "Preview a deploy without applying changes. When: before deploy-start, to see what it would add, update, delete or discard. Mode: uses the same mode as deploy-start. Set partial: false to preview the full intended state, including the files it would delete. Caveat: verdict would_fail means deploy-start is accepted and the deploy then fails, which job-status reports as state: failed. blockers.dataLoss appears only on a blocked run, naming files refused because records still exist.",
  annotations: { destructiveHint: false },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      partial: partialProperty('Report the deploy that leaves missing files in place.')
    }
  },
  handler: async (params, ctx = {}) => {
    const partial = partialOf(params);
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
    // Whether the lists below are the instance's answer at all. Without a release there was never
    // anything to ask.
    let planComputed = false;
    // `would_fail` is the answer to the question this tool is asked, not a failure of the call, so
    // it travels in the result — where the description tells the agent to read it.
    let verdict = 'not_known';
    let error;
    // Files the converter matched no rule for: a deploy drops them and still reports success.
    let discarded = [];
    let warnings;

    const clock = timing(ctx);

    if (releaseId) {
      const { state, release } = await waitForRelease(gateway, releaseId, ctx.signal, clock);
      planComputed = hasReport(release);
      categories = planComputed
        ? Object.fromEntries(Object.entries(release.report).map(([name, data]) => [name, category(data)]))
        : {};
      discarded = filesNotMatched(release);
      // The instance's own caveats, which `job-status` reports after a deploy. A dry run is when
      // they can still be acted on — 'module X is not configured for file deletion' says a delete
      // list is shorter than it looks.
      warnings = warningsExceptDiscarded(release);
      if (state === 'done') verdict = 'would_succeed';
      if (state === 'failed') {
        verdict = 'would_fail';
        error = validationError(release);
      }
    }

    // The manifest is sent, never the files: the release is a dry run, so the API validates the
    // manifest against it instead of applying it, and nothing reaches S3.
    const assetFiles = await files.getAssets();
    // `none` is a claim about the project, so it is read off the project. A check that did not run
    // answers `not_reported`, whether the release had no id or the instance refused it.
    let assets = assetFiles.length > 0
      ? { state: 'not_reported', count: assetFiles.length }
      : { state: 'none', count: 0 };

    // A release the instance has already rejected has nothing for a manifest to be validated
    // against, and waiting on one would spend a minute to learn that.
    if (assetFiles.length > 0 && verdict !== 'would_fail' && releaseId) {
      ctx.sendProgress?.({ progress: 1, total: 2, message: 'Validating assets' });
      const manifest = await manifestGenerate();
      await gateway.sendManifest(manifest, releaseId);

      // The report goes to `byCategory` with the rest of the file report, so it is read the same
      // way; what stays here is the verdict on the asset phase itself.
      const { report, ...outcome } = await waitForAssets(gateway, releaseId, ctx.signal, clock);
      assets = { ...outcome, count: assetFiles.length };
      if (report) categories.Asset = category(report);
    }

    const dataLoss = dataLossIn(categories);
    const refusedFiles = error?.files ?? [];
    const blockedByData = dataLossBlockers(error);

    return {
      applied: false,
      releaseId,
      partial,
      // The project these paths came from. `deploy-start` reports the same field, so a delete list
      // can be checked against the project it is for before it is applied.
      appPath: process.cwd(),
      // The verdict before the detail: `would_fail` means deploy-start would not succeed either,
      // and `error` says which files the instance refused.
      verdict,
      ...(error && { error }),
      // What the refusal costs, beside the instance's own words rather than instead of them. The
      // message it sends ends with the `records_delete_all` that would clear the blocker, as
      // ordinary prose — nothing in it says that command destroys data or that a person should
      // decide, and `graphql-exec` is on this same surface.
      ...(verdict === 'would_fail' && {
        blockers: {
          // Named again although `error.files` holds them: this is the one line in the answer that
          // no second deploy can undo.
          ...(blockedByData.length > 0 && {
            dataLoss: {
              count: blockedByData.length,
              files: blockedByData,
              decidedBy: 'a person: getting past these means deleting the records in those tables, and no deploy brings them back'
            }
          }),
          // The rest are in `error.files` already; what belongs here is whether there are any.
          other: { count: refusedFiles.length - blockedByData.length },
          // A blocked full deploy computes no plan at all, so this is the only way to see the rest
          // of it — two evaluations found it for themselves and nothing here said it was there.
          ...(!partial && { restOfPlan: 'Run this tool again with partial: true. A partial deploy deletes nothing, so it reports what this deploy would change apart from the deletions it is blocked on.' })
        }
      }),
      // Always present, so an agent branches on the count without having to tell "nothing was
      // dropped" from "this tool does not say".
      discarded: { count: discarded.length, files: discarded },
      ...(warnings && { warnings }),
      // Always present, and what the four fields below depend on. An instance that refused the
      // release never worked out what would change, and `deleted: {count: 0}` for a deploy that
      // would delete forty files is the most dangerous answer this tool can give — so the lists
      // are absent rather than empty, and this says which of the two it is.
      planComputed,
      ...(planComputed && {
        deleted: flat(categories, 'deleted'),
        // Only when there are any: a field that is usually empty is one a reader learns to skip,
        // and this is the one line in a delete list that cannot be undone by deploying again.
        ...(dataLoss.length > 0 && { dataLoss: { count: dataLoss.length, files: dataLoss } }),
        upserted: flat(categories, 'upserted'),
        // Counted, not named. On a dry run where nothing changes these were 88% of the whole
        // answer, listed twice — and a path that is not changing is the one thing nobody asked
        // about. What *is* changing is named above; `archive.fileCount` says how many went in.
        skipped: { count: sumOver(categories, 'skipped') },
        // Counts only: every name here was already in the three lists above, byte for byte.
        byCategory: countsByCategory(categories)
      }),
      assets,
      // No path: the archive is already removed by here.
      archive: { fileCount: numberOfFiles }
    };
  }
};

export default dryRunDeployTool;
