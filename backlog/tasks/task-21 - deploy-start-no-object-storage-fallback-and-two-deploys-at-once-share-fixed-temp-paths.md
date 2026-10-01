---
id: TASK-21
title: >-
  deploy-start: no object-storage fallback, and two deploys at once share fixed
  temp paths
status: Done
assignee: []
created_date: '2026-09-18 06:28'
updated_date: '2026-09-21 17:19'
labels:
  - mcp
  - deploy
dependencies: []
references:
  - mcp-min/deploy/start.js
  - mcp-min/deploy/assets-task.js
  - lib/assets.js
  - lib/deploy/directAssetsUploadStrategy.js
  - mcp-min/auth.js
modified_files:
  - mcp-min/deploy/start.js
  - mcp-min/deploy/dry-run.js
  - mcp-min/deploy/work-dir.js
  - mcp-min/deploy/assets-task.js
  - mcp-min/uploads/push.js
  - mcp-min/data/import.js
  - mcp-min/auth.js
  - mcp-min/jobs/adapters/data-import.js
  - mcp-min/jobs/adapters/data-export.js
  - lib/assets.js
  - lib/presignUrl.js
  - lib/prepareArchive.js
  - lib/proxy.js
  - mcp-min/__tests__/deploy.start-job.test.js
  - mcp-min/__tests__/uploads.push.test.js
  - mcp-min/__tests__/job-status.test.js
  - test/unit/presignCredentials.test.js
  - test/unit/assetsWorkDir.test.js
  - test/unit/deployAssetFallback.test.js
  - CLAUDE.md
  - CHANGELOG.md
  - docs/MCP_TOOLS.md
priority: medium
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the branch review (2026-09-18), verified against the code, and deliberately left out of TASK-13 Part 2 because each fix reaches into `lib/`.

**1. No `canPresignAssetUpload` fallback.** `lib/deploy/directAssetsUploadStrategy.js:36-42` asks the instance whether it can presign an upload *before* building the archive, and falls back to `defaultStrategy` — assets travel inside the release zip — when it cannot. `mcp-min/deploy/start.js` always archives with `withoutAssets: true` and then uploads directly, so on an instance with no object storage configured the assets can never be deployed: `presignUrl` fails, and `job-status` reports the asset phase as `failed`. An MCP deploy is silently less capable than `pos-cli deploy` on exactly the instances that need the fallback.

**2. Fixed temp paths, now held for minutes.** `deploy-start` writes `./tmp/release.zip` and `lib/assets.js` packs `./tmp/assets.zip`, both hard-coded. TASK-13 Part 2 made the asset upload wait for the release to settle first, so those paths are in use for as long as an import takes rather than for a few seconds. A second `deploy-start` in that window repacks the same files under the first upload.

**3. The `MARKETPLACE_*` window is now the whole upload.** `runWithAuth` (`mcp-min/auth.js:75-77`) documents itself as not concurrency-safe; `deploy-start` wraps the background task in it, so the env vars are set for the duration of the release wait plus the upload. A second tool resolving different credentials in that window restores the first deploy's values, or deletes them mid-flight.

Worth considering together: a per-deploy temp path (`tmp/release-<releaseId>.zip`, and a target parameter for `packAssets`), passing auth down instead of through the environment, and refusing or queueing a second `deploy-start` while `local-phases` still has one `uploading`.

**Also unverified, needs an instance:** `mcp-min/jobs/adapters/data-import.js` passes `true` for `dataImportStatus(id, csv_import)`. The CLI passes its `--zip` flag into the same slot (`bin/pos-cli-data-import.js:59`), so the parameter name and its use disagree. Comparing `/imports/:id` with and without `?csv_import=true` for a ZIP-sourced import would settle what it does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 deploy-start deploys assets on an instance that cannot presign an upload, or reports why it cannot in a way that names the cause
- [x] #2 Two deploys started close together do not overwrite each other's archive or assets zip
- [x] #3 A tool resolving credentials while a background asset upload runs cannot change or clear the credentials that upload is using
- [x] #4 The meaning of the csv_import parameter is confirmed against a real instance and the comment says what it does
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 1. The presign fallback (AC #1)

`planAssets` (`deploy/start.js`) asks `canPresignAssetUpload` in the same order and for the same
reason `lib/deploy/directAssetsUploadStrategy` does — **before** the archive is built, because the
answer decides what goes into it — and only when there is something to upload, since with no assets
the two archives are equal.

- `direct` → `withoutAssets: true` and the background upload, as before.
- `in-archive` → `withoutAssets: false`, no background upload, and `assets.status:
  "in_release_archive"` with `assets.reason` naming the cause. There is no second phase, so the
  handle carries `assets: false` and the deploy is finished when its release is in.
- Anything `canPresignAssetUpload` throws fails a call that has deployed nothing.

**This moved asset enumeration before the push, which supersedes TASK-33.** That task had to carry
"we never found out" in the handle (`flags: {}`) because enumeration ran *after* the release was
already in, so a failure could not fail the call and `assets: false` would have been read by
`job-status` as an asset phase that had finished. Enumeration now decides what goes into the
archive, so it happens first and a failure fails a call that has changed nothing — there is no
state left for a handle to be unsure about, and `flags` is always definite. TASK-33's test was
replaced by one asserting the stronger property rather than deleted.

## 2. Fixed temp paths (AC #2)

`makeWorkDir` / `removeWorkDir` (`deploy/work-dir.js`) give each call
`tmp/pos-cli-mcp-deploy/<label>-<uuid>/`. Both deploy tools use it — `deploy-dry-run` had the same
defect, one fixed name safe only against `deploy-start`'s different one — and `lib/assets.js` takes
a `workDir` (default `./tmp`, so every CLI path is unchanged) for the assets zip and the manifest.

Cleanup is at one site for everything that fails before a release exists, and after the background
upload otherwise. `archive.path` is **gone from both tools' results**: there is no longer a file
left to open, and reporting a path that is about to be removed invites a caller to depend on it.
`fileCount` stays and `deploy-start` adds `assetsIncluded`.

`lib/prepareArchive.js` had to be fixed first: `prepareDestination` did `mkdir -p tmp` rather than
the archive's own parent, so any nested path would have failed with ENOENT at `createWriteStream`.
Latent until something passed one.

## 3. The `MARKETPLACE_*` window (AC #3)

`runWithAuth` was **load-bearing**, not redundant — `lib/presignUrl.js` reads
`process.env.MARKETPLACE_URL`/`_TOKEN` directly, so removing the wrapper alone would have broken
the upload. Checked the whole background path first: `uploadFile`, `manifestGenerate`, `packAssets`
and every Gateway method read nothing from the environment, and `Gateway` already carries `url` and
`token`.

So the credentials travel with the call: `presignUrl`/`presignDirectory` take them as an argument
with the environment as the fallback, `lib/assets.js` passes its Gateway's, and `deploy-start`,
`deploy-dry-run`, `uploads-push` and `data-import` no longer call `runWithAuth` at all. The two
dry-run wrappers only ever covered Gateway calls, so they were pure hazard. `sync-file` is the one
caller left, and `runWithAuth`'s own comment now says so.

## 4. `csv_import`, settled against the instance (AC #4)

Measured 2026-09-21. It is **not** a hint and the two readers are **exclusive**:

| job | plain | with the flag |
|---|---|---|
| import 1946 (ZIP-sourced) | **503** | 200 `{"status":"done"}` |
| export 441 (`zip: false`) | 200 | **503** |
| export 892 (`zip: true`) | **503** | 200 with `zip_file_url` |

So `csv_import` does not mean "the data was CSV" — it selects the reader that can answer for a
ZIP-sourced import, and `csv_export` the same for a ZIP-producing export. The MCP adapter passing
`true` unconditionally for `data-import` is **correct**, because that tool always uploads a ZIP;
the CLI passing its `--zip` flag is correct for the same reason. `Gateway.dataExportStatus` had its
parameter named `csv_import` while writing `csv_export`; renamed.

**This matters beyond the comment.** The 503 a wrong flag produces is the *same* 503 that TASK-39
now reads as "this job does not exist" — so a guess here would report a finished job as a missing
one. That is why `data-export` carries the flag in its handle rather than inferring it, and it is
now written down where the guess would be made.

## Tested

14 new tests across `deploy.start-job.test.js` (fallback, per-deploy directories, cleanup on every
pre-release failure, credentials not exported), plus `test/unit/presignCredentials.test.js` (6) and
`test/unit/assetsWorkDir.test.js` (6). Two existing tests were rewritten rather than patched:
TASK-33's, and `uploads.push.test.js`'s "sets MARKETPLACE env vars", which asserted the behaviour
this task removes.

Six bite checks, every file restored against its sha256: no fallback → 4 fail; one fixed work
directory → 2; presign reading the environment again → 4; `deployAssets` ignoring its `workDir` →
2; `runWithAuth` back around the background upload → 1; no cleanup on failure → 3.

mcp-min 1388 passing across 59 files; `test/unit` 1329 passing with the one pre-existing TASK-9
failure, confirmed identical on a stashed tree.

## On the wire

Against the live instance, twice (before and after the final restructure), with a project carrying
one page and one asset:

- `canPresignAssetUpload` → `true`, so `direct` was chosen
- `deploy-start` → release 23265/23267, `archive: { fileCount: 1, assetsIncluded: false }`,
  `assets: { count: 1, status: "deploying_in_background" }`
- its own work directory visible for the length of the deploy, `[]` afterwards
- `job-status` → `completed`, `done: true`, `assets: { phase: "done", report: { upserted: 1 } }`
- `deploy-dry-run` → `applied: false`, `archive: { fileCount: 1 }`, work directory removed

The asset upload succeeded with **no `MARKETPLACE_*` set anywhere in the process**, which is the
live proof of AC #3.

## Not done, deliberately

- **The remote asset key is still `instances/<id>/assets/<ms>.assets_deploy.zip`**, a millisecond
  timestamp shared with the CLI. Two deploys reaching `deployAssets` in the same millisecond would
  collide in object storage; they cannot, because each waits for its own release to settle first.
  Changing a CLI-shared name without evidence of a collision was not worth it.
- **`sync-file` still uses `runWithAuth`.** Its wrapper covers a block that also sets `SYNC_SINGLE`
  and reaches further into `lib/`, so it needs its own look rather than being swept in here.
- A test page and asset were deployed to the verification instance with `partial: true`, so nothing
  there was removed.
<!-- SECTION:NOTES:END -->
