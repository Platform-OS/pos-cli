---
id: TASK-43
title: 'MCP: a file the deploy silently discarded is reported as success'
status: To Do
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 06:44'
labels:
  - mcp
  - agent-facing
  - deploy
dependencies: []
references:
  - mcp-min/jobs/adapters/deploy.js
  - mcp-min/deploy/start.js
  - mcp-min/deploy/dry-run.js
priority: high
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by an agent-perspective evaluation of the MCP server (2026-09-21).

The evaluator put a test at `app/tests/eval/simple_test.liquid` and deployed. `deploy-start` answered `ok: true` with no warning at all. `job-status` answered:

```json
"state": "completed", "status": "success", "done": true,
"result": { "release": { "warning": { "files_not_matched": ["tests/eval/simple_test.liquid"] } } }
```

The platform **does** report the dropped file. It arrives four levels down, while every field above it says the deploy succeeded. An agent checking `ok`, `state`, `status` or `done` — that is, any reasonable check — concludes the deploy landed, and the file is simply not on the instance.

Compounding it: the path came from `unit-tests-run`'s own example (`path: "tests/users"`), so the tool's documented layout points into space the deploy converter discards.

`releaseError` in `jobs/adapters/deploy.js` already reaches into `response.error.details.file_path` for a failed release; nothing does the equivalent for `warning.files_not_matched` on a successful one.

`deploy-dry-run` now reads the settled release rather than the push response (fixed on the `reduce-mcp-tool-surface` branch, 2026-09-22), so it can see `warning` before anything is applied — which is what a dry run is for.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 job-status surfaces files_not_matched at the top level of its result, not only inside the release record
- [ ] #2 A deploy that dropped a file does not read as an unqualified success on any field an agent would check
- [ ] #3 deploy-dry-run reports files the deploy would discard, before the deploy
- [ ] #4 unit-tests-run's example path is one the deploy converter actually keeps, or the description says where tests belong
- [ ] #5 A test asserts the warning is visible without walking into result.release
<!-- AC:END -->
