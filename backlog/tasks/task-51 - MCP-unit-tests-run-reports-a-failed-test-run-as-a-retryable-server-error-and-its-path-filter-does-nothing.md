---
id: TASK-51
title: >-
  MCP: unit-tests-run reports a failed test run as a retryable server error, and
  its path filter does nothing
status: Done
assignee: []
created_date: '2026-09-22 10:53'
updated_date: '2026-09-22 15:46'
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
modified_files:
  - mcp-min/tests/run.js
  - mcp-min/__tests__/tests.run.test.js
  - mcp-min/__tests__/validate-params.test.js
  - mcp-min/__tests__/error-advice.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - docs/MCP_TOOLS.md
  - CHANGELOG.md
  - CLAUDE.md
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
- [x] #1 A test run whose assertions failed answers ok:true with the failures in data, not kind:unavailable
- [x] #2 A run that could not happen at all — no runner, a refused token — is still ok:false with the right kind
- [x] #3 The parser reads the shape the endpoint actually returns, and summary carries the run's real numbers
- [x] #4 path either filters the run or is removed from the schema; it does not stay a documented no-op
- [x] #5 name is described as the substring match it is, not as a test name
- [x] #6 Tests drive a failing run, a passing run and a run narrowed by name against a fake that answers the measured shapes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed on both sides of the boundary, because two of the three defects were the tests module's rather than ours.

**The module first** (`pos-module-tests`, branch `fix-tests-json-report`, two one-word fixes):
- `show_js.liquid` iterated the empty array it had just created instead of the test contracts, so every JSON run answered `"total_assertions": 0, "tests": []` however many tests ran and however many failed. That is the whole of AC #3's "per-test detail may need a different formatter" — no other formatter was needed, the report was simply empty by construction. Verified live: `{"total_tests":2,"total_assertions":2,...,"tests":[{"name":"eval_failing_test","success":false,"assertions":1,"errors":{"sum_wrong":["expected 4 to equal 5"]}}]}`.
- `index.js.liquid` advertised `/_tests/run.js?test_name=<name>`; the runner filters on `name`, so every URL the JSON index published ran the whole suite.

**Then pos-cli.** The premise in section 2 of this task was wrong in one detail worth recording: `formatter=text` does not "return JSON" by accident — `/_tests/run` serves the `.js` page and **ignores `formatter` entirely** (measured: `?formatter=text` and `?formatter=js` return byte-identical JSON). So ~180 lines of text parser had never once received text. `unit-tests-run` now requests `/_tests/run.js` explicitly and reads the JSON; `parseTestResponse` and `extractJsonObjects` are deleted, 304 → 144 lines.

- AC #1: the body is parsed **before** the status is judged, so a 500 carrying a run is `ok: true, passed: false`. The 500 is deliberate and documented in the module as its CI signal.
- AC #2: four distinct failures instead of one — `TESTS_MODULE_MISSING` (404, module absent), `TESTS_MODULE_OUTDATED` (404 with the module present can only mean a module older than tests 1.1.0, which added the endpoint), `TESTS_NOT_AVAILABLE` (200 with the runner's own refusal outside staging/development — a case nothing previously handled), and `HTTP_ERROR` otherwise.
- AC #4: `path` **removed**, not left documented as a no-op. A parameter that silently does nothing is worse than one that is refused, because the caller believes the run was narrowed.
- Beyond the ACs: a selection matching nothing was `passed: true` (no tests → no failures). Now `NO_TESTS_MATCHED` (`not_found`) with a filter, `NO_TESTS` (`project`) without one, both carrying the `admin_liquid_partials` query that lists test files since no tool does. `name` became optional — the runner takes no filter as "every test", verified against 39 — which also removed the description's pointer to `tests-run-async`.
- Assertion messages are bounded at 2,000 characters: `should.equal` renders both compared values into the message, and one test comparing a 100 KB string produced a 103 KB result. Same suite after the bound: 4.8 KB.

`tests-run-async` and the `test-run` job kind were removed separately — see the round 2 notes in docs/MCP_COVERAGE.md.

Surface: bare 22,504 → 21,978 after the `path` removal and the dead pointer going.
<!-- SECTION:NOTES:END -->
