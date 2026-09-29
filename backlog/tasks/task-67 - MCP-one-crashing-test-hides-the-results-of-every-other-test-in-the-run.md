---
id: TASK-67
title: 'MCP: one crashing test hides the results of every other test in the run'
status: Done
assignee: []
created_date: '2026-09-29 11:16'
updated_date: '2026-09-29 13:47'
labels:
  - mcp
  - upstream
dependencies: []
references:
  - >-
    /home/ecgtheow/Work/pos-cli-mcp-eval-archive/PLATFORMOS-CLI-MCP-EVAL-5.md
    (F2)
  - /home/ecgtheow/Work/pos-cli-mcp-eval-archive/ROUND-5-TRIAGE.md (D9)
modified_files:
  - mcp-min/tests/run.js
  - mcp-min/tests/crash-check.js
  - mcp-min/__tests__/tests.run.test.js
  - mcp-min/__tests__/error-advice.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - docs/MCP_TOOLS.md
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A test that raises takes the whole run down. The runner answers 500 with an error page, and every other test's result is lost with it.

Measured in an agent evaluation: running the full suite crashed on one bad test and returned nothing about the **37+ other tests** that would have passed or failed. The agent recovered only by narrowing to a subset (`unit-tests-run {name: "gen/"}`), which then reported 36 tests and 6 failures normally. So the results exist; one raise is enough to withhold all of them.

`unit-tests-run` already does what it can once a crash has happened: it separates a raise from an unwell instance, and reads the failing file, line, exception class and message out of the instance's error log. That tells you *which* test broke. It cannot tell you what the other tests did, because the run never finished and the runner reports nothing about a run that did not finish.

The runner belongs to the `tests` platformOS module, not to this repository, so settle what is possible here before building anything:

- Whether the module offers any way to continue past a raising test, or to report per-test results as it goes.
- Whether running a crash-free subset automatically is worth it, or whether that is an expensive guess an agent should make for itself.
- Whether this is simply an upstream request against the `tests` module, in which case the outcome of this task is that request plus whatever the tool can say in the meantime.

Do not implement a workaround before answering those. Splitting one run into many is a real cost — the evaluation's full-suite run was one request — and a per-test loop would pay it on every green run to protect against a rare red one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 It is established and written down whether the tests module can report results from a run that a raise interrupted
- [x] #2 If nothing can be done in this repository, the task ends in a filed upstream request against the tests module, linked here
- [x] #3 If something can be done, the cost is measured on a suite that does not crash, so a rare failure does not slow every ordinary run
- [x] #4 A crashed run still reports the file, line and exception it already reports today
- [x] #5 The tool's description tells the caller what a crash does to the rest of the run, so the gap is known rather than discovered
- [x] #6 Tests cover whatever behaviour ships, including a suite where one test raises and others would have failed
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
**Outcome: fixed upstream, in the tests module itself, and pos-cli adjusted to match.**

The task asked whether the module can report results from a run a raise interrupted. Established from `modules/tests/commands/run.liquid`: it could not — the whole suite runs in one Liquid render, each contract accumulates in a variable, and the report is rendered *after* the loop, so a raise aborted the render and took the collected results with it. Confirmed live on 2026-09-29: a test that passes on its own reported nothing when it ran in the same call as a test that raised after it.

It turned out to be fixable, and the fix is merged: **pos-module-tests `a8e87e9`**. Each test runs inside `try`/`catch`, and a raise is recorded on that test's own contract under the error key `(raised)` with the exception class, file, line and message. `{% try %}` is a platformOS Liquid tag and catches across the `include` boundary — verified before writing anything. One trap: `err` is not cleared when a `try` completes, so without `assign err = null` the catch of every later test fires on the first one's error.

Same call, same instance, before and after: `unit-tests-run {}` went from `TEST_RUN_CRASHED` and nothing else to 17 matched, 38 assertions, **12 passing**, 4 raised, 1 assertion failure. The four raises were one real bug in the instance's own code that had been invisible.

**What changed in pos-cli**, now that the gap is closed rather than permanent:

- The description clause added earlier — *"A test that raises ends the whole run and no other result survives it"* — **came back out** (-108 B). It was true of the old module and would now be a sentence about a module version, paid on every request by every agent.
- What replaced it is the key an agent branches on: `tests[].errors names the assertion, or (raised) when the test itself raised` (+41 B). **Net -67 B**, recorded in the byte ledger; the dev budget came back down to 10,180 (actual 10,113), because lowering a ceiling is what keeps it load-bearing.
- **`TEST_RUN_CRASHED` stays**, because instances run older modules — and reaching it is now itself the version check. It gained `details.remedy` naming `pos-cli modules update tests && pos-cli deploy <env>`, which costs nothing until a run actually crashes, and its message says a newer module reports a raise as a failing test.
- A run where a test raised is an ordinary failing run to this tool, since the body is parsed before the status. Nothing had to change for that — which is exactly why it is now **pinned by a test**, against a body carrying a passing test, a `(raised)` test and an assertion failure together.

Five mutations run against the suites for the adjustment — the `(raised)` key dropped, the old warning restored, the remedy removed, the message's module sentence removed, and per-test errors dropped — each caught by a named test. `error-advice.test.js`'s ledger of every `command:` in `mcp-min/` gained `tests/crash-check.js`, which is the check doing its job.

The analysis is kept as `backlog/docs/doc-1`, retitled to record that it was fixed directly rather than filed, with the root cause, the measurements and the regression checks.
<!-- SECTION:FINAL_SUMMARY:END -->
