---
id: TASK-46
title: >-
  MCP: result field names that mislead, and payload an agent pays for on every
  call
status: Done
assignee: []
created_date: '2026-09-22 06:45'
updated_date: '2026-09-22 12:09'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/check/run.js
  - mcp-min/graphql/exec.js
  - mcp-min/jobs/adapters/deploy.js
  - mcp-min/logs/fetch.js
modified_files:
  - mcp-min/check/run.js
  - mcp-min/logs/fetch.js
  - mcp-min/__tests__/check-run.test.js
  - mcp-min/__tests__/logs.fetch.test.js
  - docs/MCP_TOOLS.md
  - CLAUDE.md
  - CHANGELOG.md
priority: medium
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by an agent-perspective evaluation of the MCP server (2026-09-21). Individually small, and every one of them is paid for on every call.

**Names that mislead**

- `check-run` returns `fileCount: 0` beside `filesChecked: 2`. Nothing says `fileCount` means "files with offences", so a clean run reads as *"nothing was checked"*. The evaluator only decoded it by re-running against dirty code and watching `fileCount` go to 1. Rename it `filesWithOffenses`.
- `deploy-start` returns `status: "ready_for_import"`, which is outside the `running` / `completed` / `failed` vocabulary the instructions define for job state. Two vocabularies, one field name.
- `job-status` carries `module_deployment`, `true` on the evaluator's partial deploys and `false` on its non-partial ones, with nothing explaining why.

**Payload with no reader**

- `graphql-exec` double-wraps: `data.data.records`. Consistent and predictable, but every access path pays for it.
- `job-status` ships the whole release record: `name: "User import"` on a deploy, `creator: "Unknown"`, `deleted_at`, `instance_id`, `downloadable`.
- `logs-fetch` rows carry `data: null` and an `updated_at` that duplicates `created_at` — about 15% of each row, on a tool whose `limit` goes to 10,000.

Each is a judgement about what an agent reads versus what the API happens to return. The rule the repo already follows for logging applies: name the fields that help, rather than passing a whole upstream object through.

`liquid-exec`'s always-null `error` is the same class and is filed with TASK-41, where the fix is in the same file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 check-run's count of files with offences is named for what it is
- [x] #2 A field an agent branches on uses one vocabulary across tools, or the difference is documented where it appears
- [x] #3 Release and log records are reduced to fields something reads, or their size is recorded as a deliberate cost
- [x] #4 The saving is measured, per tool, against a real result rather than estimated
- [x] #5 Renamed fields are reflected in docs/MCP_TOOLS.md and in the tool descriptions that mention them
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured against real results before deciding anything (AC #4), on the live instance 2026-09-22:

- a release record is **815 bytes**, 566 without the eight fields nothing here reads;
- a log row is **322 bytes**, 270 without `data` and `updated_at`;
- `module_deployment` matched `options.partial_deployment` on **8 of 8** sampled releases (23265,
  23267, 23275, 23277, 23279, 23282, 23283, 23284), so it says "this was a partial deploy" and
  nothing about modules;
- `name` is `"User import"` on every release, whatever it was.

**The two payload cases are not the same case, and they got opposite answers.**

`logs-fetch` trims: `data` when null, `updated_at` when it repeats `created_at` — per row and only
when empty, never by an allowlist. So a row that does carry `data`, or that was updated after it was
written, keeps both, and this cannot lose something the instance meant. 52 bytes of 322 — 16% — on a
tool whose `limit` goes to 10,000, confirmed live at 270 bytes after the change.

`job-status` does **not** trim the release record, and that 249 bytes is recorded as the deliberate
cost the AC allows. An allowlist has to be maintained, and a field the platform adds goes silently
missing — which is exactly how a discarded file stayed invisible for a release (TASK-43). It is also
the position I took for `downloadable` in TASK-44, and it would have been easy to quietly reverse it
here for 249 bytes. `name` and `module_deployment` are documented rather than removed.

`check-run`'s `fileCount` → `filesWithOffenses` (AC #1), with the tests and `docs/MCP_TOOLS.md`
following (AC #5). Verified live: `filesWithOffenses: 0, filesChecked: 44` now says what the old
`fileCount: 0, filesChecked: 2` could not.

AC #2: `state` and `status` are two vocabularies on purpose — ours and the instance's — and
`deploy-start` returns the instance's. Documented where both appear rather than unified, because
the instance's own word for a moment is worth passing through.

`graphql-exec`'s `data.data` is left alone with the reason recorded: the outer is this server's
envelope, the inner is GraphQL's and travels beside `errors`, so unwrapping would either lose
`errors` or make the shape depend on whether the query succeeded.

Five deliberate reverts, sha256-verified restore, all caught — including the two that matter most,
dropping `data` when it carries something and `updated_at` when it differs, which is what separates
a lossless trim from a lossy one. mcp-min 1539 passing across 62 files; test/unit 1336 with the
pre-existing TASK-9 failure only.
<!-- SECTION:NOTES:END -->
