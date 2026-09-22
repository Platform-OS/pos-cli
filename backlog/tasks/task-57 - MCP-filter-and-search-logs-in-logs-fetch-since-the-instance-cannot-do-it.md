---
id: TASK-57
title: 'MCP: filter and search logs in logs-fetch, since the instance cannot do it'
status: Done
assignee: []
created_date: '2026-09-22 17:21'
updated_date: '2026-09-22 18:08'
labels:
  - mcp
  - agent-facing
  - logs
dependencies: []
modified_files:
  - mcp-min/logs/fetch.js
  - mcp-min/__tests__/logs.fetch.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - docs/MCP_TOOLS.md
  - docs/MCP_COVERAGE.md
  - CHANGELOG.md
priority: high
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`logs-fetch` takes only `lastId` and `limit`. Round 2 of the agent evaluation was set the task "find a specific error in the logs without reading everything" and reported it survivable only by luck — its instance held exactly five rows, so the error it wanted was on the first page. Its words: there is "no filter by error_type (the rows *have* one), no free-text match, no time window, no newest-first order", so "on any instance with a real log volume the only strategy is to page forward from the beginning until you reach now, paying for every row."

TASK-28 was the planned answer — expose `logsv2 search`, which searches the log store with SQL. **That is blocked**: the whole logsv2 stack is unreachable (TASK-56). So the question became whether the same need can be met against `/logs`, which does work.

## What was measured first, on 2026-09-22

- **The instance cannot filter.** `/logs` ignores `error_type`, `q`, `search`, `order` and `limit` — each returns byte-identical results to a nonsense parameter. So any filtering has to happen in the tool.
- **A time window is free, though.** A row id is a microsecond epoch of the same instant `created_at` names (`1790097411.2168736` ↔ `2026-09-22T17:16:51.216Z`), and `last_id` is a strict greater-than. So a timestamp converts straight into a starting cursor and the **instance** does the skipping. Only the text matching is local.
- **The rows carry what is worth filtering on**: `error_type`, `message`, `created_at`, `data`.

## Why it is worth doing even though the filtering is client-side

An agent's scarce resource is context, not bandwidth. Paging rows over HTTP and returning only the matches turns "ten thousand rows into the model's context" into "twelve". The transfer cost stays with the server and the tool, where it is cheap.

## Design decisions already taken

- **Extend `logs-fetch` rather than add a `logs-search` tool.** The underlying operation is identical — page the same endpoint — and the difference is only which rows come back. Two log tools would also invite picking the wrong one, which TASK-28 AC #7 warns about, and `--profile dev` has little byte headroom.
- **Substring and case-insensitive.** `pos-cli logs --filter` is an exact match on `error_type`, so `--filter error` does not match a row typed `Liquid error`. Reproducing that here would be reproducing a trap.
- **`since` and `lastId` are refused together** rather than resolved by precedence: a caller that passed both meant one of them, and choosing silently starts the read somewhere they did not ask for.
- **No `order: newest` for now.** The endpoint only reads forward from a cursor, so "newest" means paging to the end. `since` is the affordable way to ask for recent rows.

## State: done

Implemented in `mcp-min/logs/fetch.js`, tested, verified against the verification instance, and documented. See the final summary below for what was built and what was left out.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 errorType and contains narrow the returned rows, matched as case-insensitive substrings
- [x] #2 since starts the read just after a given time, by converting it to a cursor the instance honours — not by fetching and discarding
- [x] #3 since and lastId together are refused with a clear input error rather than one silently winning
- [x] #4 limit counts matching rows, and the scan is bounded so a narrow filter over a busy log cannot page forever
- [x] #5 A result that stopped at the scan bound says so, because 'nothing matched' and 'stopped looking' are different answers
- [x] #6 The cursor advances over rows that did not match, so a filtered read is still resumable
- [x] #7 Verified against a live instance with rows that do and do not match, not only against fakes
- [x] #8 The tools/list byte pins are updated deliberately, and the dev profile cost is argued
- [x] #9 logs-fetch's description says the filtering happens in the tool, so a caller understands why a narrow search over a large log takes time
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`logs-fetch` gained `since`, `errorType` and `contains`.

**What was built**

- `errorType` and `contains` match case-insensitive substrings against a row's `error_type` and `message`, and combine as an AND. A message that is not a string is searched as the text it renders to, which `pos-cli logs` also does. Deliberately a substring and not the exact `error_type` equality `pos-cli logs --filter` uses, where `--filter error` misses a row typed `Liquid error`.
- `since` takes an ISO-8601 time and converts it to a cursor: the seconds and milliseconds of the instant, built from the integer milliseconds so no float rounding reaches the string. The instance does the skipping, so nothing is fetched and discarded. A time before the epoch reads from the oldest row kept.
- `since` and `lastId` together are refused with `SINCE_AND_LAST_ID` (`kind: input`) before any request is made.
- A call reads at most `MAX_SCAN` (10,000) rows — the same ceiling `limit`'s maximum already had. `scanned` is reported when a filter was used; `scanLimitReached` when the bound, rather than `limit` or the end of the stream, is what ended the read.
- The cursor advances over every row read, not only the rows returned, so a filtered read resumes after the rows it rejected.

**Cost**

`tools/list` grew 481 bytes, measured: the dev profile 8,741 → 9,222 and the bare surface 22,099 → 22,580. The dev budget was raised 9,000 → 9,400 with the argument recorded in `tool-surface.test.js`: this is a capability, not prose, the instance cannot do the narrowing itself, and the alternative is a second log tool (450–900 B, plus the risk of picking the wrong one) whose data source is unreachable anyway.

**Testing**

31 new tests in `mcp-min/__tests__/logs.fetch.test.js` (24 → 55, all passing; full mcp-min suite 1,566). Each was bite-checked by breaking the implementation on purpose, and the file restored by sha256 afterwards: advancing the cursor only over returned rows, dropping the millisecond zero-padding, letting `since` win over `lastId`, matching either field case-sensitively, reporting `scanned` unconditionally, reporting `scanLimitReached` regardless of why the read stopped, dropping the `INVALID_SINCE` guard, searching `error_type` instead of `message`, and removing the scan bound — every one failed the tests that name it. One test had to be strengthened after the first pass: it used an uppercase needle against a lowercase message, which the filter-side lowercasing alone handles, so it did not catch a case-sensitive row side.

Verified against the verification instance on 2026-09-22 with its five real rows across two `error_type` values: each filter returned exactly the expected rows, a filter matching nothing returned `count: 0` with the cursor advanced past all five, `since` at two different times returned three rows and one row, `since` with `lastId` was refused, and an unparseable `since` was rejected by the published schema.

**Not done, deliberately**

No newest-first order: the endpoint only reads forward from a cursor, so "newest" means paging to the end. `since` is the affordable way to ask for recent rows. Filtering on `data` is not supported — `contains` searches `message` only, and says so.
<!-- SECTION:FINAL_SUMMARY:END -->
