---
id: TASK-1.16
title: >-
  dns compare: stripped oversized DNS record details cause silent false
  negatives
status: Done
assignee: []
created_date: '2026-07-24 09:01'
updated_date: '2026-07-24 09:12'
labels: []
dependencies: []
references:
  - 'lib/dns/exportSchema.js:15'
  - lib/dns/compare.js
parent_task_id: TASK-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code review of the DNS migration feature found that `dns export`'s `stripBulkyDetails` (lib/dns/exportSchema.js:15) replaces any `details.<key>` value exceeding 100KB (e.g. `dns_verification_records`, `extra_dns_records`, `dns_zone_name_servers`) with a plain string like `[stripped: ... exceeded ... bytes]`.

When such an export file is later used as `--source-file`/`--target-file` in `pos-cli dns compare`, `lib/dns/compare.js`'s `indexVerificationRecords`/`indexLiveRecords` iterate that field expecting an array of record objects. Each character of the string is skipped by the `typeof record !== 'object'` guard, so the index silently comes back empty instead of erroring. Any real record drift in that oversized field becomes invisible in the compare output — the tool reports OK/no advisory even though the two portals actually differ, defeating the DNS-parity check for exactly the domains most likely to have real content (many live DNS records).

This is a correctness gap in a safety tool: `dns compare` exists specifically to catch drift before/after migration, and a silent false negative undermines that guarantee.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When `dns compare` processes a domain whose details field was stripped during export (per exportSchema.js's stripBulkyDetails marker), it surfaces a clear warning or error for that domain instead of silently treating the field as empty/matching
- [x] #2 The comparison result for a domain with stripped details is never reported as clean/OK without an explicit caveat that some record data could not be compared
- [x] #3 Add a test in test/ covering a domain whose exported details exceeded the stripping threshold, verifying compare surfaces the caveat/error rather than a false-clean result
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `isStrippedDetail()` to lib/dns/exportSchema.js and a symmetric `uncomparableDetail()` guard in lib/dns/compare.js covering all three details fields compare reads (dns_verification_records, extra_dns_records, dns_zone_name_servers). When either side's field was stripped during export, compareDomain now pushes a CRITICAL message ("could not be compared — the export stripped it...") instead of silently indexing the marker string as an empty array. Added unit tests in exportSchema.test.js and compare.test.js.
<!-- SECTION:FINAL_SUMMARY:END -->
