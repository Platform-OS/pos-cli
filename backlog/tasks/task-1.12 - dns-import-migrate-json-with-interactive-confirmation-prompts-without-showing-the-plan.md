---
id: TASK-1.12
title: >-
  dns import/migrate: --json with interactive confirmation prompts without
  showing the plan
status: Done
assignee: []
created_date: '2026-07-23 19:05'
updated_date: '2026-07-23 19:20'
labels:
  - code-review
  - dns
dependencies: []
references:
  - bin/pos-cli-dns-import.js
  - bin/pos-cli-dns-migrate.js
  - lib/dns/guard.js
parent_task_id: TASK-1
priority: medium
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in code review of the dns-migration branch.

Plan rendering is gated on `!params.json` (bin/pos-cli-dns-import.js:69-72, bin/pos-cli-dns-migrate.js:67-69), but the confirmApply gate still prompts when running interactively without --yes (import.js:84, migrate.js:188). An interactive run with --json therefore asks "Apply these DNS changes to <target>?" without ever having displayed what would be applied — a blind confirmation in a tool whose safety model is plan-then-confirm.

Two reasonable resolutions, pick one: emit the plan as JSON before prompting, or refuse --json without --yes/--dry-run with an actionable message (mirroring the existing non-TTY refusal in lib/dns/guard.js confirmApply).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An interactive --json run is never asked for confirmation without the plan having been output first (or the run is refused with an actionable message)
- [x] #2 Non-interactive, --yes, and --dry-run behavior is unchanged
- [x] #3 Tests cover the json + interactive confirmation path
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Chose the refusal resolution: confirmApply({json}) throws 'With --json there is no plan review to confirm — pass --yes to apply, or --dry-run to preview the plan as JSON' before any prompt. Non-interactive/--yes/--dry-run paths unchanged (guard tests cover all branches).
<!-- SECTION:NOTES:END -->
