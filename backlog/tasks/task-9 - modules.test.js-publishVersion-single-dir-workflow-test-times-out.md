---
id: TASK-9
title: 'modules.test.js: publishVersion single-dir workflow test times out'
status: To Do
assignee: []
created_date: '2026-09-02 10:24'
labels:
  - bug
  - tests
  - modules
dependencies: []
references:
  - test/unit/modules.test.js
  - lib/modules.js
  - .github/workflows/tests.yaml
priority: medium
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing failure on `master`. Confirmed not caused by the `add-ajv-input-validation` branch: reproduced identically in a clean `master` worktree with the same `node_modules`.

```
FAIL test/unit/modules.test.js > publishVersion() — pre-flight validation
     > does not error about directory when modules/ does not exist (single-dir workflow)
Error: Test timed out in 10000ms.
  at test/unit/modules.test.js:379
```

Every other test in the file passes (27/28). The rest of `test/unit` is green (1153 passing) apart from this one, so it is the only thing standing between the repo and a clean `npm test`.

The test writes a manifest with `machine_name` and `version` and no `modules/` directory at all, then expects `publishVersion` to get past the pre-flight directory check and reach archiving. The 10s timeout suggests the call is waiting on something rather than throwing — a prompt with no TTY, or a network call to the Partner Portal, are the obvious candidates given the test environment has no real credentials.

Note this failure is invisible unless you run the suite: CI runs `npm test`, which runs the whole thing, so it should be failing there too — worth checking whether CI is currently red on `master` or whether something about the CI environment makes this test pass. Also note `npm run pretest` must have run (it installs the yeoman fixtures) or `test/unit/generators.test.js` fails separately for an unrelated reason, which is easy to confuse with this.

Either fix the hang or, if the scenario is genuinely unsupported, change the test to assert what `publishVersion` should do instead.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 npm run test:unit passes with no failures
- [ ] #2 The cause of the hang is identified and stated in the fix (prompt without TTY, unmocked network call, or similar)
- [ ] #3 If publishVersion cannot support the single-dir workflow, the test asserts the intended behaviour rather than being deleted or skipped
- [ ] #4 It is confirmed whether CI on master is currently failing on this test, and recorded in the task notes
<!-- AC:END -->
