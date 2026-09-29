---
id: TASK-64
title: 'MCP: three published strings that are inaccurate or read wrongly'
status: Done
assignee: []
created_date: '2026-09-29 11:15'
updated_date: '2026-09-29 12:21'
labels:
  - mcp
  - docs
dependencies: []
references:
  - >-
    /home/ecgtheow/Work/pos-cli-mcp-eval-archive/PLATFORMOS-CLI-MCP-EVAL-5.md
    (F6, F8)
  - '/home/ecgtheow/Work/pos-cli-mcp-eval-archive/ROUND-5-TRIAGE.md (D5, D6, D7)'
modified_files:
  - mcp-min/deploy/dry-run.js
  - mcp-min/tests/run.js
  - mcp-min/jobs/status.js
  - mcp-min/__tests__/deploy.dry-run.test.js
  - mcp-min/__tests__/tests.run.test.js
  - mcp-min/__tests__/job-status.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - docs/MCP_TOOLS.md
  - docs/MCP_COVERAGE.md
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An agent evaluation hit three strings this server publishes. Two state something untrue; the third is true but reads as something else. Grouped because they are one reviewable change and none needs a behaviour decision.

**1. `deploy-dry-run` promises a refusal that does not happen.** Its description says *"would_fail means deploy-start would be refused too"*. It is not refused: the push is accepted, `deploy-start` returns `ok: true` with a `job_id`, and the failure surfaces later through `job-status` as `state: failed`. Confirmed in code — `deploy-start` returns immediately after the push with no settlement wait. The evaluation deployed a page with a Liquid syntax error, got a job id back, and was left unsure whether its assets had been uploaded, because the same result said `assets.status: "deploying_in_background"`.

**2. `unit-tests-run` names a path that does not exist on disk.** The `name` parameter says assertions live *"under modules/tests/assertions/"*. That is the Liquid **call path** (`function contract = 'modules/tests/assertions/equal'`), and it is correct as a call path and as a `admin_liquid_partials` filter. The files are at `modules/tests/public/lib/assertions/`. The evaluation worked it out and noted it "reads like a directory". The sentence was added in round 4 and verified as a call path, not for how it would be read as a location.

**3. `job-status` produces a doubled period.** `envNotFound` (`mcp-min/auth.js`) ends its message with `.`, and `mcp-min/jobs/status.js` appends `. The job was started on <origin>`, giving *"Configured: verification.. The job was started on …"*. The appended hint itself is useful and should stay.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 deploy-dry-run's description says what would_fail actually means for deploy-start: the deploy is accepted and then fails, with the outcome read from job-status
- [x] #2 unit-tests-run's name parameter makes clear that modules/tests/assertions/ is how a test refers to an assertion, not where the files sit
- [x] #3 job-status no longer emits two periods when it adds the instance the job was started on, and still adds it
- [x] #4 Each of the three is pinned by a test that fails if the string goes back to what it said before
- [x] #5 docs/MCP_TOOLS.md agrees with the corrected descriptions
- [x] #6 The net change to tools/list is recorded in the byte ledger in mcp-min/__tests__/tool-surface.test.js with its reason
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All three corrected, each pinned by a test that fails if the string goes back.

**1. `would_fail` does not mean `deploy-start` is refused.** Confirmed live on 2026-09-29 before writing the new sentence: a full deploy the instance would refuse came back from `deploy-start` as `ok: true` with a `job_id` and `instanceStatus: ready_for_import`, and `job-status` reported `state: failed` on the first poll. The description now says it is accepted and then fails, and names `job-status` as where the outcome is read. `docs/MCP_TOOLS.md` gains a paragraph, including why the evaluation was left unsure about its assets — the same result said `assets.status: deploying_in_background`.

**2. `modules/tests/assertions/` is a reference, not a directory.** Verified in this repository's own fixtures: `test/fixtures/test/with-passing-tests/app/lib/test/passing_one_test.liquid` calls `include 'modules/tests/assertions/equal'`, and the file is at `modules/tests/public/lib/assertions/equal.liquid` — the converter strips `public/lib/`. The `name` parameter now says "calling assertions by reference — include modules/tests/assertions/equal, not a path on disk". `SHOW_ASSERTIONS` is untouched: as an `admin_liquid_partials` filter that path is correct.

**3. The doubled period.** Reproduced first — `"Environment 'verification' is not in .pos. Configured: staging, prod.. The job was started on https://staging.example.com"` — then fixed by stripping a trailing full stop from the resolver's message before appending. The hint itself stays, and the test pins both halves: the instance is still named, and the message contains no `..`.

Four mutations were run against the suites — restoring each of the three strings, and dropping the instance name from the job-status hint — and every one is caught by a named test.

+93 B on `tools/list`, recorded in the byte ledger; the dev budget was raised to 10,150, with this and the round's other clauses argued individually. `docs/MCP_COVERAGE.md` and the agent guide were corrected too — both restated the assertions sentence, and the guide also restated the `would_fail` claim.

Full MCP suite: 61 files, 1692 tests, green.
<!-- SECTION:FINAL_SUMMARY:END -->
