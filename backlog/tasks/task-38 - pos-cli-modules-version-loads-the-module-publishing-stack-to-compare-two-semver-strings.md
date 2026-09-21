---
id: TASK-38
title: >-
  pos-cli modules version loads the module-publishing stack to compare two
  semver strings
status: To Do
assignee: []
created_date: '2026-09-21 14:16'
labels:
  - modules
  - performance
  - tests
dependencies: []
references:
  - lib/modules/version.js
  - lib/modules.js
  - lib/modules/paths.js
  - bin/pos-cli-modules-version.js
  - test/unit/modulesVersion.test.js
priority: low
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`bin/pos-cli-modules-version.js` does very little: read `pos-module.json`, compare or bump a semver, write the file back, and optionally touch `template-values.json`. It costs about **0.8 s** per invocation on an idle Linux machine.

Measured, on this repository:

```
   44 ms   bare node
   33 ms   import lib/program.js
    2 ms   import lib/modules/paths.js
  218 ms   import lib/modules.js
  205 ms   import lib/modules/version.js      <- almost entirely lib/modules.js
  716 ms   node bin/pos-cli-modules-version.js --no-git 1.0.0
  776 ms   node bin/pos-cli.js modules version --no-git 1.0.0   (three processes)
```

The 218 ms is one import. `lib/modules/version.js:8` takes `moduleConfig` from `lib/modules.js`, and that module pulls in the whole publishing path — `Portal`, `prepareArchive`, `presignUrl`, `s3UploadFile`, `waitForStatus`, `utils/password`, `utils/twoFactor`, `ServerError`, `fast-glob`. None of it is reachable from a version bump. The Partner Portal client and the S3 uploader are loaded to decide whether `1.0.0` is greater than `2.0.0`.

This is a small user-facing cost on a command people run in release scripts, and it is also what makes `test/unit/modulesVersion.test.js` fragile: that file spawns the three-process chain fifteen times, and on a loaded Windows CI runner the first (cold) spawn exceeded the 10 s default timeout. That test's timeout has been raised to 30 s as the immediate fix; this task is the underlying weight, and cutting it would take roughly a quarter off every one of those spawns.

The likely shape of the fix is to give `moduleConfig` a home that does not drag the publishing stack with it — it is a small manifest reader, and `lib/modules/paths.js` already exists as the light module beside it. Check what else imports `moduleConfig` before moving it, and confirm nothing depends on `lib/modules.js` being loaded as a side effect.

Worth measuring the sibling commands in the same pass: every `pos-cli modules *` leaf goes through the same three-process dispatch, and if they all import `lib/modules.js` for something small, the same fix pays off more than once.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A version bump no longer imports the Partner Portal client, the S3 uploader or the archive builder, verified by measuring the import cost before and after and recording both numbers
- [ ] #2 pos-cli modules version behaves identically: the same exit codes, the same manifest and template-values.json writes, and the same messages, with test/unit/modulesVersion.test.js passing unchanged
- [ ] #3 Whatever moduleConfig moves to is reached by every current caller, and nothing relied on lib/modules.js loading as a side effect
- [ ] #4 Any other modules subcommand found to import the publishing stack for something small is measured and reported in this task, fixed here if the fix is the same one
- [ ] #5 If the saving is large enough that test/unit/modulesVersion.test.js no longer needs its raised timeout, the timeout and its comment are revisited rather than left behind
<!-- AC:END -->
