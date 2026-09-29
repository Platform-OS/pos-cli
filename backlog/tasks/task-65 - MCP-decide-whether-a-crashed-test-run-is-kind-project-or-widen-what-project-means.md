---
id: TASK-65
title: >-
  MCP: decide whether a crashed test run is kind project, or widen what project
  means
status: Done
assignee: []
created_date: '2026-09-29 11:15'
updated_date: '2026-09-29 12:27'
labels:
  - mcp
  - decision
dependencies: []
references:
  - >-
    /home/ecgtheow/Work/pos-cli-mcp-eval-archive/PLATFORMOS-CLI-MCP-EVAL-5.md
    (F2, F5)
  - /home/ecgtheow/Work/pos-cli-mcp-eval-archive/ROUND-5-TRIAGE.md (D3)
  - >-
    /home/ecgtheow/Work/pos-cli-mcp-eval-archive/ROUND-4-TRIAGE.md (D3, where it
    was kept)
modified_files:
  - mcp-min/tool-error.js
  - mcp-min/instructions.js
  - mcp-min/tests/crash-check.js
  - mcp-min/__tests__/instructions.test.js
  - docs/MCP_TOOLS.md
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two agent evaluations, in separate rounds, have objected to `TEST_RUN_CRASHED` carrying `kind: project`.

The server instructions gloss `project` as *"the project or machine is not ready"*. Round 5 put the objection as: *"A test raising is a fault in my code, not an unready project. The kind points to the wrong fix."* Round 4 said the same thing in different words.

Round 4 defended the pairing — the next step is to fix code in the project, which is what `project` means here — and that defence rests on a reading the published gloss does not carry. "Not ready" maps to *install something, deploy something, fix the machine*; it does not map to *your test divides by zero*. Every other `project` producer fits the published gloss: `NO_TESTS` (module absent), `NO_DIRECTORIES`, `MISSING_DEPENDENCY`, `TESTS_NOT_AVAILABLE`. `TEST_RUN_CRASHED` is the odd member of that set.

`input` is not obviously right either: the arguments were fine, the deployed code was not. `instance` is wrong — the instance ran what it was given.

This is a decision, not a patch, and it should be settled rather than defended a third time. Two ways to settle it:

1. **Reclassify** `TEST_RUN_CRASHED`, accepting that no kind fits it perfectly and choosing the one whose published gloss misleads least.
2. **Widen the gloss on `project`** in `mcp-min/instructions.js` to cover deployed project code that is faulty, so the existing classification becomes true of what the instructions say.

`ERROR_KINDS` is a closed set of eight shared across the whole surface, so adding a ninth is not on the table. Whichever is chosen, `instructions.test.js` derives the required kinds from the table and will need to agree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The kind TEST_RUN_CRASHED carries and the gloss the instructions publish for that kind describe the same situation
- [x] #2 The reasoning for the choice is written down where the next reader will find it, including why the rejected option was rejected
- [x] #3 Every other producer of the chosen kind still fits the gloss after the change
- [x] #4 ERROR_KINDS remains the same closed set of eight
- [x] #5 Tests cover the classification, and instructions.test.js still derives the kind list from the table rather than repeating it
- [x] #6 docs/MCP_TOOLS.md and the agent guide agree with whatever is decided
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
**Option 2: the kind stays `project` and the published gloss was widened to say what it always covered.**

The objection was to the words, not to the classification. Every kind is a next step, and the next step for a deployed test that raised is to change code in the project and deploy it again — which is what `project` means and what no other member of the closed set means. "The project or machine is not ready" maps to *install or deploy something*, so the guidance pointed at a different fix from the one the error needed, and the kind took the blame for the sentence.

Published gloss, in `mcp-min/instructions.js`:

> `project: fix the project or machine — its files, its setup, or code it has deployed`

`ERROR_KINDS.project` (the table the instructions restate, not published on the wire) says the same in its own voice.

**Why `input` was rejected**, written into `tests/crash-check.js` where the classification is made: the arguments were fine, so an agent told to fix them goes back to `name` and finds nothing wrong with it. `instance` is wrong — the instance ran what it was given and is answering other requests, which is exactly what `instanceAnswersForItself` establishes *before* this error is built. `internal` would report the user's own test as a pos-cli defect. `ERROR_KINDS` stays a closed set of eight.

**Every other producer still fits**, checked one by one — `NO_DIRECTORIES` and `EMPTY_ARCHIVE` are its files; `ENV_INCOMPLETE`, `MISSING_DEPENDENCY`, `TESTS_MODULE_MISSING`, `TESTS_MODULE_OUTDATED`, `TESTS_NOT_AVAILABLE` and `NO_TESTS` are its setup; `MIGRATION_NOT_WRITTEN` is the machine's filesystem; `TEST_RUN_CRASHED` is code it has deployed.

`instructions.test.js` still derives the required kinds from `ERROR_KINDS` rather than repeating them, and gains one test that reads the published `project` clause and requires it to name deployed code and not to say "not ready". Three mutations were run — the gloss reverting, the gloss dropping deployed code, and the crash reclassified as `input` — and each is caught by a named test.

+41 B on the instructions, which are sent once a session; the budget went 1,625 → 1,675 with the argument written out, keeping the ~50 bytes of headroom that ceiling has always had. `docs/MCP_TOOLS.md` and the agent guide's kind tables were updated to match.

Full MCP suite: 61 files, 1693 tests, green.
<!-- SECTION:FINAL_SUMMARY:END -->
