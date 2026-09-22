---
id: TASK-46
title: >-
  MCP: result field names that mislead, and payload an agent pays for on every
  call
status: To Do
assignee: []
created_date: '2026-09-22 06:45'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/check/run.js
  - mcp-min/graphql/exec.js
  - mcp-min/jobs/adapters/deploy.js
  - mcp-min/logs/fetch.js
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
- [ ] #1 check-run's count of files with offences is named for what it is
- [ ] #2 A field an agent branches on uses one vocabulary across tools, or the difference is documented where it appears
- [ ] #3 Release and log records are reduced to fields something reads, or their size is recorded as a deliberate cost
- [ ] #4 The saving is measured, per tool, against a real result rather than estimated
- [ ] #5 Renamed fields are reflected in docs/MCP_TOOLS.md and in the tool descriptions that mention them
<!-- AC:END -->
