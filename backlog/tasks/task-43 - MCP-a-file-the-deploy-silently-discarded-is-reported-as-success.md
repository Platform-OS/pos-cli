---
id: TASK-43
title: 'MCP: a file the deploy silently discarded is reported as success'
status: Done
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 10:56'
labels:
  - mcp
  - agent-facing
  - deploy
dependencies: []
references:
  - mcp-min/jobs/adapters/deploy.js
  - mcp-min/deploy/start.js
  - mcp-min/deploy/dry-run.js
modified_files:
  - mcp-min/jobs/adapters/deploy.js
  - mcp-min/deploy/dry-run.js
  - mcp-min/jobs/status.js
  - mcp-min/tests/run.js
  - mcp-min/__tests__/job-status.test.js
  - mcp-min/__tests__/deploy.dry-run.test.js
  - mcp-min/__tests__/tests.run.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - CLAUDE.md
  - CHANGELOG.md
  - docs/MCP_TOOLS.md
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
- [x] #1 job-status surfaces files_not_matched at the top level of its result, not only inside the release record
- [x] #2 A deploy that dropped a file does not read as an unqualified success on any field an agent would check
- [x] #3 deploy-dry-run reports files the deploy would discard, before the deploy
- [x] #4 unit-tests-run's example path is one the deploy converter actually keeps, or the description says where tests belong
- [x] #5 A test asserts the warning is visible without walking into result.release
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced on the live instance before changing anything, and then measured the boundary the report
only guessed at. On 2026-09-22, deploying the eval project:

- `warning: { files_not_matched: ["tests/eval/simple_test.liquid"] }` sits on the release record
  beside `status: "success"`, and `job-status` answered `state: completed, done: true,
  status: success` with **no** warnings field at all;
- probing three candidate paths at once through a dry run: `app/tests/**` is discarded, while
  `app/lib/probe/b_test.liquid` and `app/lib/tests/probe/a_test.liquid` are both **upserted as
  Partials**. So `app/lib` is where a test file survives a deploy and `app/tests` is not — which is
  the actual content of AC #4.

**`state` stays `completed`, deliberately.** The deploy finished; what the converter kept is a fact
about the project, not a failed operation. `running | completed | failed` is shared by five job
kinds and `done` derives from it, so a fourth member would cost all of them for one case. The
honest maximum is to make the fact unmissable *beside* `state` rather than to restate it as a
failure — so `warnings` (a field `job-status` already had, populated only from `error.warnings` on a
failed release) is now populated for a successful one too, and the tool description says to read it
on `completed`. A field an agent is never told to read is a field it does not read.

`releaseWarnings` bounds the readable list at ten paths — a misplaced directory drops every file
under it — while `result.release.warning` keeps all of them, and passes an unrecognised warning key
through rather than dropping it, so the next one the platform adds is not invisible for a release.

`filesNotMatched` is exported from the adapter and used by `deploy-dry-run`, which already imported
`releaseState` from there: one reader of the platform's warning shape. The dry run reports
`discarded: { count, files }` — the shape its three sibling categories already use — always present
so an agent can branch on the count, and it does **not** move `verdict`: the deploy really would
succeed, minus those files, and folding the two would tell an agent less than before, not more.

Byte budgets: the dev profile's three separate raises across TASK-41/42/43 are consolidated into one
6,500 → 7,000 with a single argument, because they are one purchase — an evaluation found four
descriptions in this profile stating things that were not true. The comment now says the argument is
spent: the next addition comes out of existing text, since at 7,000 the dev profile is already 38%
of the full surface it exists to avoid.

Also fixed while in the file: `docs/MCP_TOOLS.md` still told readers the dry run writes
`tmp/release-dry-run.zip`, a path it has not used since TASK-21, and contradicted itself two
paragraphs later.

Not verified: that the runner path `tests/users` maps to `app/lib/tests/users`. The verification
instance has no tests module installed — `unit-tests-run` answered `TESTS_MODULE_MISSING` with the
remedy, which is TASK-40 working in the wild — so the description states only what was measured:
test files live under `app/lib`, and a deploy discards `app/tests` without failing.

Verified live end to end after the change: the dry run named both discarded files before the
deploy, and `job-status` reported them in `warnings` beside `state: completed`. 14 deliberate
reverts, sha256-verified restore, all caught. mcp-min 1489 passing across 61 files; test/unit 1336
with the pre-existing TASK-9 failure only.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Follow-up, after installing `tests@1.3.5` on the verification instance: the item left as "not verified" above is now measured, and it came out differently from the inference.

The tests module filters with `admin_liquid_partials(filter: { path: { ends_with: "_test", contains: $path } })` and passes `context.params.name` into it. So:

- a test is **any liquid partial whose path ends with `_test`**, from `app/lib/**` or `app/views/partials/**`; there is no required `tests/` directory, and `tests/users` in the old example was never a location;
- `name` is a **substring** match on that partial path, not a test name — `name=probe` ran all four tests under `probe/`;
- **`path` is ignored entirely** — `?path=zzz-does-not-exist` ran the whole suite.

The `path`/`name` descriptions were corrected here rather than left claiming a filter that does not happen: `path` now says it is ignored and points at `name`, and `name` carries the app/lib guidance AC #4 asked for. Making the parameter work or removing it is TASK-51, along with two worse things the same probe exposed — a failing test run answers HTTP 500 and so reaches the agent as `kind: unavailable` ("retry later") with the failure nowhere in the result, and `parseTestResponse` does not understand the JSON the endpoint actually returns.

Instance state left behind, deliberately, so TASK-51 can be verified: `tests@1.3.5` is installed and deployed on the verification instance, with `app/lib/tests/probe/pass_test.liquid` and `fail_test.liquid` in the eval project. Bare `tools/list` is 18,471 with the corrected descriptions.
<!-- SECTION:FINAL_SUMMARY:END -->
