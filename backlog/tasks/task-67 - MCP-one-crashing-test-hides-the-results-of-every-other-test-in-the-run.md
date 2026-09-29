---
id: TASK-67
title: 'MCP: one crashing test hides the results of every other test in the run'
status: Done
assignee: []
created_date: '2026-09-29 11:16'
updated_date: '2026-09-29 12:46'
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
**Established first, as the task asked: the tests module cannot report results from a run a raise interrupted, and nothing in this repository can recover them.**

From the module's own source (`modules/tests/commands/run.liquid`), the whole suite runs in one Liquid render: each test's contract accumulates in a variable and the report is rendered by `test_formatter` **after** the loop. A raise inside `include test.path` aborts that render, so the loop never finishes, the formatter never runs, and the results already collected die with it.

**Confirmed live on 2026-09-29.** The tests module and three tests were deployed to fk-block — one passing, one with a failing assertion, one raising (a `{% graphql %}` naming a query file that does not exist, which deploys cleanly and raises at render):

| run | result |
|---|---|
| `t67_pass` alone | `passed: true, matched: 1, assertions: 1` |
| `t67_fail` alone | `passed: false, failures: 1`, with the assertion message |
| `t67_crash` alone | `TEST_RUN_CRASHED` |
| all three | `TEST_RUN_CRASHED` — nothing about the other two |

A second pair pinned the stronger claim, that results *already computed* are discarded: `t67b_apass_test` reports a pass on its own, and reports **nothing at all** when it runs in the same call as `t67b_zcrash_test`, which sorts after it.

**Nothing was implemented as a workaround**, and the reasoning is written into `crash-check.js`: running each test in its own request would recover the rest, and would pay for a rare crash on every green suite. The caller already knows which test raised — the error names the file, line and exception — and can narrow `name` to exclude it, which is a judgement about their own suite rather than one this server should make.

**What ships** is the gap being known rather than discovered:

- `unit-tests-run`'s description: *"A test that raises ends the whole run and no other result survives it, so narrow with name to see the rest."* — read before the call, which is the last moment the caller can choose a narrower run.
- The `TEST_RUN_CRASHED` message now says the run "stopped and reported nothing — including any test that had already passed".
- The file, line, exception class and message are unchanged, and the degraded path was exercised for real: fk-block's error log is frozen, so the crash lookup found no row and the message fell back to pointing at `logs-fetch`, exactly as designed.

**The upstream request is drafted, not filed** — filing an issue on another project's tracker is outward-facing, so it needs your say-so. It is `backlog/docs/doc-1`, with the source excerpt, the measurements above and three possible fixes in order of preference.

+108 B on `tools/list`, in the byte ledger; the dev budget went to 10,250 with this argued alongside the round's other clauses. Two tests added, two mutations run — the description clause removed, and the crash message reverted — each caught by a named test.

Full MCP suite: 61 files, 1704 tests, green. The five scratch test files were deleted from fk-block afterwards; the instance is back to its own 17 community-module tests.
<!-- SECTION:FINAL_SUMMARY:END -->
