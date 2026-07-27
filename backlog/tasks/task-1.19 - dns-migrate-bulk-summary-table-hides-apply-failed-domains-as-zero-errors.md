---
id: TASK-1.19
title: 'dns migrate: bulk summary table hides apply-failed domains as zero errors'
status: Done
assignee: []
created_date: '2026-07-24 09:01'
updated_date: '2026-07-24 09:12'
labels: []
dependencies: []
references:
  - 'bin/pos-cli-dns-migrate.js:92'
  - 'lib/dns/apply.js:88'
parent_task_id: TASK-1
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code review found that `bulkSummaryRow` in `bin/pos-cli-dns-migrate.js` (lines 92-104) builds its "errors" column by summing only `counts.error` and `counts.invalid`. `lib/dns/apply.js:88-91` sets `result.status = 'apply-failed'` when a domain's apply POST is accepted but the polled `last_operation_status` later reports a provisioning failure.

Because `bulkSummaryRow` never counts `apply-failed` into applied/blocked/errors, a bulk migrate run's printed table row can show e.g. `domains: 2, applied: 1, blocked: 0, errors: 0` even though one domain actually failed to provision. The overall process still exits 1 (`exitCodeFor` does include `apply-failed`), but an operator scanning the per-instance summary table across a large cohort run has no visual signal of which instance(s) failed, or that anything failed at all for that row.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bulkSummaryRow's error/failure count includes domains with status 'apply-failed' (either folded into the existing errors column or shown as a distinct visible count)
- [x] #2 A bulk migrate run containing an apply-failed domain shows a non-zero failure indicator in that instance's summary row
- [x] #3 Add a test with a mocked apply-failed result verifying the summary row reflects the failure
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extracted the bulk per-instance counting logic into `summarizeBulkOutcome()` in lib/dns/cliHelpers.js, now including `apply-failed` in the errors count alongside error/invalid/hasErrors. bin/pos-cli-dns-migrate.js's bulkSummaryRow uses this shared helper. Added unit tests in cliHelpers.test.js covering apply-failed and independent counting of all four columns.
<!-- SECTION:FINAL_SUMMARY:END -->
