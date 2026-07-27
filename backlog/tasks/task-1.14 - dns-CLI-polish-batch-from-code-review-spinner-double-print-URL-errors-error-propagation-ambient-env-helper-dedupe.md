---
id: TASK-1.14
title: >-
  dns: CLI polish batch from code review (spinner double-print, URL errors,
  error propagation, ambient env, helper dedupe)
status: Done
assignee: []
created_date: '2026-07-23 19:06'
updated_date: '2026-07-23 19:20'
labels:
  - code-review
  - dns
dependencies: []
references:
  - bin/pos-cli-dns-export.js
  - lib/dns/guard.js
  - lib/dns/auth.js
  - lib/dns/mapping.js
  - bin/pos-cli-dns-import.js
  - bin/pos-cli-dns-migrate.js
parent_task_id: TASK-1
priority: low
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Batch of small, independent findings from the dns-migration branch code review, all within the dns command group — one focused PR:

1. bin/pos-cli-dns-export.js:71 — `spinner.stopAndPersist().succeed(...)` prints two lines per instance (the persisted "Exporting <uuid>" frame plus the ✓ success line); a single `spinner.succeed(...)` is intended.

2. A scheme-less portal URL (e.g. `--portal-url portal.example.com`) dies with a bare "Invalid URL" thrown by `new URL()` (lib/dns/guard.js:8 assertWritablePortal, lib/dns/auth.js:94 resolveInstanceUuid). Emit a friendly message telling the user the portal URL must include the scheme (https://).

3. lib/dns/mapping.js:68 — matchByDomain swallows searchInstances failures via `.catch(() => null)`, so a transient network/portal error is misreported as "no instance on <portal> has any of the domains". It fails safe (the pair is skipped, nothing written) but the diagnosis is wrong; lookup failures should be distinguishable from genuine no-match.

4. lib/dns/auth.js:43 — the `PARTNER_PORTAL_HOST` env fallback applies to BOTH source and target sides, which sits oddly next to the same file's design comment that dns commands deliberately avoid ambient env so source and target never silently resolve to the same place; the same-portal+same-uuid check in migrate only guards non-bulk mode. Decide whether the env fallback should apply to dns commands at all, and align code and comment.

5. `collect`, `filterByDomains`, and `exitCodeFor` are duplicated between bin/pos-cli-dns-import.js and bin/pos-cli-dns-migrate.js — repo convention (CLAUDE.md) is thin bin files with shared logic in lib/, e.g. a lib/dns/cli-helpers.js.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 dns export prints exactly one line per exported instance
- [x] #2 A scheme-less --portal-url value produces an actionable error message instead of a bare 'Invalid URL'
- [x] #3 matchByDomain reports portal lookup failures distinctly from 'no matching instance'
- [x] #4 The PARTNER_PORTAL_HOST fallback behavior for dns commands is decided and the code and design comment in lib/dns/auth.js agree
- [x] #5 Helpers shared by the dns bin files live in lib/dns instead of being duplicated
- [x] #6 Behavior changes are covered by tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
1) export uses spinner.succeed() - one line per instance (visual, verified by smoke). 2) hostnameOf() in cliHelpers wraps URL parsing with 'must include the scheme, e.g. https://...' - used for portal urls (resolvePortalContext + guard) and instance urls (resolveInstanceUuid); tested. 3) matchByDomain rethrows searchInstances failures as 'instance lookup for <domain> on <portal> failed: ...' - tested. 4) DECIDED: dns commands never read PARTNER_PORTAL_HOST (removed the fallback; design comment updated; test asserts the ambient var is ignored). 5) collect/filterByDomains/exitCodeFor/backupPathFor deduped into lib/dns/cliHelpers.js, all four bins import them. 6) all behavior changes tested except the cosmetic spinner fix.
<!-- SECTION:NOTES:END -->
