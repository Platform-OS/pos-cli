---
id: TASK-21
title: >-
  deploy-start: no object-storage fallback, and two deploys at once share fixed
  temp paths
status: To Do
assignee: []
created_date: '2026-09-18 06:28'
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
- [ ] #1 deploy-start deploys assets on an instance that cannot presign an upload, or reports why it cannot in a way that names the cause
- [ ] #2 Two deploys started close together do not overwrite each other's archive or assets zip
- [ ] #3 A tool resolving credentials while a background asset upload runs cannot change or clear the credentials that upload is using
- [ ] #4 The meaning of the csv_import parameter is confirmed against a real instance and the comment says what it does
<!-- AC:END -->
