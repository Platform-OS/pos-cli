---
id: TASK-1.20
title: >-
  dns transform: normalizeName is case-sensitive against domainName, breaking
  www-strip for mixed-case domains
status: Done
assignee: []
created_date: '2026-07-24 09:01'
updated_date: '2026-07-24 09:12'
labels: []
dependencies: []
references:
  - 'lib/dns/normalize.js:51'
  - lib/dns/transform.js
parent_task_id: TASK-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code review found that `normalizeName()` in `lib/dns/normalize.js` (lines 47-51) lowercases the record name (`short = (name || '').trim().toLowerCase()...`) but then compares its suffix against the raw, un-lowercased `domainName` argument: `if (domainName && short.endsWith(\`.${domainName}\`))`.

If a source domain's canonical name is ever mixed-case (e.g. `Example.com`, which can occur from a legacy v1 `_domains` fallback name rather than the v2 `attributes.domain_name`), `short` becomes `www.example.com` (lowercased) but is checked against `.Example.com` (not lowercased) — the suffix never matches, so the www record's name stays as the full `www.example.com` instead of the expected short form `www`.

Downstream, `isWwwRedirectRecord()` in transform.js checks `record.name === 'www'`, so it fails to recognize the record, the auto-added www-redirect CNAME is NOT dropped, and it gets sent to the target as an explicit record. The target portal also auto-adds its own www-redirect from `enable_www_redirect`, producing a duplicate/conflicting record and likely a "destructive change" or duplicate-record rejection on apply.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 normalizeName's suffix comparison is case-insensitive with respect to domainName (e.g. lowercase domainName once alongside short before comparing)
- [x] #2 A www CNAME record for a mixed-case domain name (e.g. 'Example.com') is correctly normalized to the short form 'www' and recognized by isWwwRedirectRecord
- [x] #3 Add a unit test in the normalize/transform test suite covering a mixed-case domainName input
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lib/dns/normalize.js's normalizeName() now lowercases domainName before the apex-equality and suffix checks, so a mixed-case domain name (e.g. 'Example.com') correctly strips to the short form ('www') and matches apex. Added unit test in normalize.test.js covering mixed-case domainName inputs.
<!-- SECTION:FINAL_SUMMARY:END -->
