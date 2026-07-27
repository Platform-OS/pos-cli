---
id: TASK-1.17
title: 'dns compare: --domain filter silently ignored in bulk (--mapping-file) mode'
status: Done
assignee: []
created_date: '2026-07-24 09:01'
updated_date: '2026-07-24 09:12'
labels: []
dependencies: []
references:
  - 'bin/pos-cli-dns-compare.js:59'
parent_task_id: TASK-1
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code review found that in `bin/pos-cli-dns-compare.js`, the bulk `params.mappingFile` branch (lines 59-103) never reads `params.domain`. It calls `compareInstance(sourceSide.domains, targetSide.domains, {...})` for every domain in each instance pair with no filtering applied — unlike the non-bulk branch further down, which does `results.filter(result => wanted.has(...))`.

Running `pos-cli dns compare --mapping-file pairs.csv --domain foo.com` therefore silently prints/returns full per-instance results for every domain instead of the requested subset, and the exit code / totals are based on all domains rather than the filtered set. This is misleading in CI, where the caller expects a scoped pass/fail signal for just the named domain.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When `pos-cli dns compare --mapping-file <file> --domain <name>` is run, only the named domain is compared/reported per instance pair in the bulk branch, matching the filtering behavior of the non-bulk branch
- [x] #2 Totals and exit code in bulk mode reflect only the filtered domain set when --domain is supplied
- [x] #3 Add a test covering bulk compare combined with --domain, asserting output/totals are scoped to the named domain
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extracted the domain-filter + totals-recompute logic (previously inline only in the single-pair branch) into a shared `filterOutcomeByDomain()` helper in lib/dns/cliHelpers.js, and applied it in both the bulk (--mapping-file) and single-pair branches of bin/pos-cli-dns-compare.js. --domain now scopes results/totals identically in both modes. Added unit tests in cliHelpers.test.js.
<!-- SECTION:FINAL_SUMMARY:END -->
