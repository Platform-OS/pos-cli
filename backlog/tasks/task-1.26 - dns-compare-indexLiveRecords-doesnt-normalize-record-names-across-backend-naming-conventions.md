---
id: TASK-1.26
title: >-
  dns compare: indexLiveRecords doesn't normalize record names across backend
  naming conventions
status: Done
assignee: []
created_date: '2026-07-24 11:11'
updated_date: '2026-07-24 11:17'
labels: []
dependencies: []
references:
  - 'lib/dns/compare.js:34'
parent_task_id: TASK-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Discovered via a real migration test (a customer domain exported from partners.platformos.com, migrated to a private-stack portal, then compared): `pos-cli dns compare` reported the domain's two SRV records (`_sip._tls`, `_sipfederationtls._tcp`) as both "only on source" and "only on target" under `details.extra_dns_records`, even though the records exist on both sides.

Root cause: `lib/dns/compare.js`'s `indexLiveRecords()` built its comparison Map key from the raw `record.name`, lowercased only — unlike `recordKey()`/`indexIntentRecords()` (used for the "intent" config comparison), which already call `normalizeName(record.name, domain)` to strip the domain suffix. Different DNS-provider backends store the same record's name differently: the legacy stack (Route53) stores SRV record names fully domain-qualified (e.g. `_sip._tls.example.com`), while the private-stack (Cloudflare-backed) stores them short (`_sip._tls`). `indexLiveRecords` keyed these as two different map entries, so the record never matched between source and target and was reported as missing on both sides — pure noise.

Worse: this false "missing" noise was masking a real, separate drift. Once names are normalized and the records actually match up, the SRV *values* differ: source has `100 1 443 sipdir.online.lync.com.` (full 4-field priority/weight/port/target), target has `1 443 sipdir.online.lync.com` (3 fields — priority dropped). The target's own *intent* config (what pos-cli's transform sent) has the correct 4-field value, so the drop happens between "accepted by the target portal" and "what's actually live" — likely a bug in the target private-stack's Cloudflare integration (Cloudflare models SRV `priority` as a field separate from `weight`/`port`/`target`; a read-back path that only reads the latter three would produce exactly this). That part is NOT a pos-cli issue and is out of scope for this task — flagged separately to whoever owns that private-stack's DNS provisioning code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 indexLiveRecords normalizes record names the same way recordKey/indexIntentRecords already do (normalizeName(record.name, domain) || '@'), so a record stored fully-qualified on one side and short on the other matches correctly
- [x] #2 A record present on both sides with different live values now reports as a single 'records differ' advisory instead of two misleading 'only on source'/'only on target' advisories
- [x] #3 Add a regression test in compare.test.js reproducing the real-world scenario (SRV name fully-qualified on source, short on target, differing values) and asserting it surfaces as 'records differ', not 'only on'
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed indexLiveRecords (lib/dns/compare.js) to accept the domain name and normalize record names via normalizeName() before building its comparison Map key, matching the existing pattern in recordKey()/indexIntentRecords(). Updated compareDomain's call site to pass the domain name. Added a regression test in compare.test.js reproducing the exact real-world scenario (Route53 fully-qualified SRV name vs Cloudflare short name, with a genuinely differing value) and verified against a real export file pair offline via `pos-cli dns compare --source-file --target-file` — the phantom 'only on source'/'only on target' pair collapsed into a single correct 'records differ' advisory revealing the real SRV-priority drift. Full unit suite (1044 tests) passes.
<!-- SECTION:FINAL_SUMMARY:END -->
