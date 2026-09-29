---
id: TASK-61
title: >-
  MCP: logs-fetch limit returns the oldest rows of the newest page, not the
  newest
status: Done
assignee: []
created_date: '2026-09-29 11:14'
updated_date: '2026-09-29 12:04'
labels:
  - mcp
  - bug
dependencies: []
references:
  - >-
    /home/ecgtheow/Work/pos-cli-mcp-eval-archive/PLATFORMOS-CLI-MCP-EVAL-5.md
    (F3)
  - /home/ecgtheow/Work/pos-cli-mcp-eval-archive/ROUND-5-TRIAGE.md (D1)
modified_files:
  - mcp-min/logs/fetch.js
  - mcp-min/__tests__/logs.fetch.test.js
  - mcp-min/__tests__/cancellation.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - docs/MCP_TOOLS.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`logs-fetch` with a `limit` and no filter, no `lastId` and no `since` returns the **oldest** rows of the newest page, while its description says it starts "at the newest rows".

Measured against a live instance 2026-09-29:

```
logs-fetch {limit: 5}   → rows 10:07:19 … 10:07:39
logs-fetch {}           → rows 10:07:19 … 13:10:05   (the newest page, 20 rows)
```

The platform answers an uncursored read with its newest page **oldest-first**, and the handler stops after the first `limit` matching rows — so `limit: 5` hands back the five oldest of the newest twenty. "Show me the last 5 log rows" is the most ordinary call this tool has, and it is the one that answers wrongly. An agent evaluation caught it only because `newestRow` from a different call disagreed.

The behaviour predates the round-4 work; the description sentence that makes it a stated contradiction was added then, and was verified for the filtered path only.

Two candidate fixes, to be decided in the task:

1. **Take `limit` from the newest end on an unfiltered read** — scan the page, keep the last n. Matches what the caller asked for and what the description claims. Costs nothing, since the page is already in hand. Makes `limit` mean "oldest first" when filtering and "newest" when not, which must then be stated.
2. **Leave the behaviour and correct the sentence** so it says the read *starts* at the newest page and `limit` truncates from the oldest end of it.

Option 1 is recommended.

Filtered reads are not affected: they start at the oldest retained row by design, where "oldest first" is correct.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A read with a limit, no filter and no cursor returns rows that are actually the newest the instance holds, or the published description states plainly which end limit truncates from
- [x] #2 The chosen behaviour is pinned by a test that fails if the rows come back from the wrong end of the page
- [x] #3 Filtered reads still start at the oldest retained row and still take limit oldest-first, with a test covering both paths in one place
- [x] #4 logs-fetch's tool description and docs/MCP_TOOLS.md agree with the behaviour that ships
- [x] #5 Any change to the published description is recorded in the tools/list byte ledger in mcp-min/__tests__/tool-surface.test.js with its reason
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Option 1 was taken: `limit` now takes rows from the newest end of a read that starts at the newest page, which is what the description already claimed and what "show me the last five log rows" means.

**The rule keys on the cursor, not on which parameter was absent.** `last_id=0` is the newest page, so a read that starts there is one page — nothing is newer than the page the instance has just sent. `newestPage` in `logs/fetch.js` is `latestId === NEWEST_PAGE`, which covers both the default and an explicit `lastId: "0"`. Such a read now walks the whole page and keeps the last `limit` rows; every other read stops the moment it has `limit`, so nothing about reading forward changed.

**It also costs one request instead of two.** The loop stops after the newest page rather than asking the instance to confirm there is nothing after it. Measured against a live instance on 2026-09-29, before and after, against the same six-row log:

| call | before | after |
|---|---|---|
| `{}` | 6 rows, 2 requests | 6 rows, 1 request |
| `{limit: 2}` | the two **oldest** rows (23:46:48.743, .811), cursor left mid-page | the two **newest** (23:46:49.428, .486), cursor on the newest row |

`limit`'s published description now names the end for each kind of read (+66 B, recorded in the byte ledger; the dev budget was raised to 9,900 with the argument written out).

**Three existing tests were reading through a fake that does not model `last_id=0`.** `instanceWith` answers `0` as an ordinary greater-than, so tests that "paged" from no cursor were exercising a path the platform does not have. They now name the cursor they page from, and the newest-page cases are covered against `platformWith`, which does model it. `cancellation.test.js` had the same fiction and was fixed the same way.

Seven mutations were checked against the suite — no trim, trimming the wrong end, no one-page stop, the inner loop stopping at `limit`, every read or no read treated as a newest-page read, and the old description — and each is caught by a named test. Two further mutations proved to be semantically identical to the original and the redundant guards behind them were removed rather than covered.

Full MCP suite: 61 files, 1673 tests, green.
<!-- SECTION:FINAL_SUMMARY:END -->
