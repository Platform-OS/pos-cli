---
id: TASK-1.27
title: >-
  dns: extract the migrate/import apply pipeline and bulk cohort runner from
  bins into lib/dns
status: To Do
assignee: []
created_date: '2026-07-24 14:35'
labels:
  - dns
  - refactoring
dependencies: []
references:
  - bin/pos-cli-dns-migrate.js
  - bin/pos-cli-dns-import.js
  - bin/pos-cli-dns-compare.js
  - lib/dns/cliHelpers.js
  - lib/dns/mapping.js
parent_task_id: TASK-1
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to the /simplify altitude review of the dns command group: the two multi-mode bins still contain multi-step orchestration that the repo's thin-bin convention (restated in lib/dns/cliHelpers.js) says belongs in lib/.

Two duplications remain after the smaller helper extractions (portalFlags, dropValuePatterns, reportApplyResults, writeEnvelope, readEnvelope):

1. The transform -> plan -> confirm -> apply -> collect statuses -> cutover pipeline is implemented twice: as migratePair() in bin/pos-cli-dns-migrate.js and inline in bin/pos-cli-dns-import.js. They had already drifted in small ways before the shared reporter was extracted, and any change to the apply flow (new result status, changed confirmation semantics, changed cutover collection) must currently be made in both, even though README documents import as "same transform and safety rules as migrate".

2. Bulk cohort orchestration (pair resolution via --mapping-file/--instances-file + matchByDomain, per-pair try/catch with error-outcome accumulation, summary/grand-total accumulation) lives in the migrate and compare bins. The per-pair failure outcome shape is owned by the migrate bin (errorOutcome factory); a lib-level cohort runner next to lib/dns/mapping.js would own it in one place and let bins only print.

Constraints (no behavior change): the documented exit-code contract (0/1/2/3), JSON output shapes, confirmation semantics (confirmApply guard, --yes/--json rules), and messages must be preserved. Deliberate sequencing must survive the refactor: portal POSTs stay sequential (provision-worker queue), and the two sides of compare must keep loading sequentially (concurrent interactive password prompts race on shared stdin - see the comment in bin/pos-cli-dns-compare.js).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The transform->plan->confirm->apply->cutover flow lives in one lib/dns module used by both dns migrate and dns import; neither bin contains the duplicated orchestration anymore
- [ ] #2 Bulk cohort iteration (pair resolution, per-pair failure outcomes, totals accumulation) lives in lib/dns and is shared by migrate's and compare's bulk modes; the error-outcome shape is defined in exactly one place
- [ ] #3 CLI behavior is unchanged: exit codes match the documented 0/1/2/3 contract in single and bulk modes, JSON output shapes are identical, and confirmation prompt semantics (--yes/--json/non-interactive refusal) are preserved
- [ ] #4 Deliberate sequencing is preserved: portal writes stay sequential, and compare's two sides keep resolving sequentially so interactive password prompts never race on shared stdin
- [ ] #5 The extracted lib modules have unit tests covering the pipeline gates (dry-run, transform-error stop, abort-on-decline, apply, cutover collection) and the cohort runner's failure accumulation - coverage must not regress versus the current bin-level flow
- [ ] #6 README dns section reviewed; updated only if any user-facing wording or flag help changed (none expected)
<!-- AC:END -->
