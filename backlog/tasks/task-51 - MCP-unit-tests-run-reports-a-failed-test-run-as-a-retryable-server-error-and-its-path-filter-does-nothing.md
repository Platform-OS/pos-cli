---
id: TASK-51
title: >-
  MCP: unit-tests-run reports a failed test run as a retryable server error, and
  its path filter does nothing
status: To Do
assignee: []
created_date: '2026-09-22 10:53'
labels:
  - mcp
  - agent-facing
  - tests
  - correctness
dependencies: []
references:
  - mcp-min/tests/run.js
  - mcp-min/tests/run-async.js
  - mcp-min/jobs/adapters/test-run.js
priority: high
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while verifying TASK-43 AC #4, after installing `tests@1.3.5` on the verification instance and deploying one passing and one failing test at `app/lib/tests/probe/`. Three separate defects, all measured on 2026-09-22.

## 1. A failing test run is reported as `unavailable`, and the failure never reaches the caller

`/_tests/run` answers **HTTP 500** when an assertion fails. The body is the result:

```
POST /_tests/run?formatter=text&name=fail_test   → 500
{"success":false,"total_tests":1,"total_assertions":0,"total_errors":1,"duration_ms":39,"tests":[]}
```

`kindForStatus(500)` makes that `unavailable`, so the tool answers:

```json
{ "ok": false, "error": { "kind": "unavailable", "code": "HTTP_ERROR",
                          "message": "Request failed with status 500" } }
```

`unavailable` means *"nothing was decided; the same call may work later"*. Everything was decided: a test failed, and the same call will fail identically for ever. The agent is told to retry, and is never told a test failed at all.

This inverts the rule CLAUDE.md states for this exact case — *"a test run with failing assertions is `completed`, because the run did its work"* and *"A failure of the work is not a failure of the call"* — which `job-status` and `tests-run-async` keep and `unit-tests-run` does not.

It is TASK-43's defect in the mirror: there, a real failure was dressed as success; here, a real result is dressed as an outage.

## 2. `parseTestResponse` does not understand the response

The parser expects an indented text format. `formatter=text` returns **JSON**: `{success, total_tests, total_assertions, total_errors, duration_ms, tests}`. A passing run therefore answers:

```json
{ "tests": [{ "raw": [ … ] }], "summary": { "assertions": 0, "failed": 0, "timeMs": 0, "totalErrors": 0 },
  "passed": true, "totalTests": 1 }
```

`summary` is junk rather than the run's real numbers, and `tests` is a raw dump. Before any test file existed the same parser produced `tests: [null]`. Note `tests: []` and `total_assertions: 0` come back empty from this formatter even for runs that assert, so the per-test detail may need a different formatter — `formatter=json` should be checked before rewriting the parser.

## 3. `path` is ignored by the tests module

`modules/tests/public/lib/commands/run.liquid` filters with `admin_liquid_partials(filter: { path: { ends_with: "_test", contains: $path } })`, and passes `path: context.params.name`. It never reads `context.params.path`.

Measured: `?path=zzz-does-not-exist` ran all four tests; `?name=fail_test` ran one. So a run an agent narrowed with `path` quietly runs the whole suite and reports on all of it.

`name` is a **substring** match on the partial path, not a test name: `name=probe` matched all four tests under `probe/`.

TASK-43 changed the two descriptions to say this rather than leave them claiming a filter that does not happen, which is a stopgap — the parameter should either work or go.

## What a partial path is, for reference

Measured via `admin_liquid_partials`: `app/lib/probe/b_test.liquid` → `probe/b_test`, `app/lib/tests/probe/a_test.liquid` → `tests/probe/a_test`, `app/views/partials/eval/marker.liquid` → `eval/marker`. So a test is any liquid partial whose path ends with `_test`, from `app/lib/**` or `app/views/partials/**` — there is no required `tests/` directory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A test run whose assertions failed answers ok:true with the failures in data, not kind:unavailable
- [ ] #2 A run that could not happen at all — no runner, a refused token — is still ok:false with the right kind
- [ ] #3 The parser reads the shape the endpoint actually returns, and summary carries the run's real numbers
- [ ] #4 path either filters the run or is removed from the schema; it does not stay a documented no-op
- [ ] #5 name is described as the substring match it is, not as a test name
- [ ] #6 Tests drive a failing run, a passing run and a run narrowed by name against a fake that answers the measured shapes
<!-- AC:END -->
