---
id: TASK-1.15
title: >-
  dns: verify portal invariants assumed by apply polling and record-name
  validation
status: Done
assignee: []
created_date: '2026-07-23 19:06'
updated_date: '2026-07-23 19:20'
labels:
  - code-review
  - dns
dependencies: []
references:
  - lib/dns/apply.js
  - lib/dns/transform.js
parent_task_id: TASK-1
priority: low
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two open questions from the dns-migration branch code review — verify each against the partner-portal backend (or actual portal behavior) and fix the pos-cli side only where the assumption does not hold:

1. lib/dns/apply.js:8 — `settled()` requires `locked === false` in the GET /api/domains/:name response. If any supported private-stack target portal omits the `locked` field, every apply polls to the full timeout (120s per domain by default) and reports stillProcessing even for completed provisions — painful in bulk cohort runs. Confirm all target portal versions in scope return `locked`, or make settled() tolerant of its absence.

2. lib/dns/transform.js:6 — NAME_FORMAT (/^[a-z0-9_.-]*$/) rejects `*`, so a wildcard DNS record (e.g. *.example.com) fails validation and blocks the whole domain's transform. The comment says types mirror the portal's Api::Record model; confirm the target portal's record-name validation actually rejects wildcards. If the portal accepts them, transform must allow them through; if it rejects them, the current early failure with a clear message is correct.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both invariants are verified against portal code or live behavior, with the findings recorded in this task's notes
- [x] #2 settled() polling behaves correctly (no poll-to-timeout on settled domains) for every supported target portal version
- [x] #3 Wildcard record handling in the transform matches what the target portal actually accepts
- [x] #4 Any code change is covered by unit tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
VERIFIED against partner-portal private-stack code: (1) locked is ALWAYS emitted - app/models/domain_status.rb:20 'locked: processing?' where processing? (line 89) returns dns_provision&.locked_at.present? || false, i.e. always boolean, both v1/v2 shapes; and only private-stack portals can be apply targets (legacy portal is write-protected). Invariant holds; settled() nevertheless hardened to !status.locked so a missing field settles instead of polling to timeout (tested). (2) Wildcards: app/models/api/record.rb:57 validate_name_format /\A[a-z0-9_\.-]*\z/ rejects '*' - the portal 422s wildcard names, so the transform's early per-record error is the correct matching behavior; no change.
<!-- SECTION:NOTES:END -->
