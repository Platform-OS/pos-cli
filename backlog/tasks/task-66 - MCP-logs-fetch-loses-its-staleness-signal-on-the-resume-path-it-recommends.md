---
id: TASK-66
title: 'MCP: logs-fetch loses its staleness signal on the resume path it recommends'
status: Done
assignee: []
created_date: '2026-09-29 11:16'
updated_date: '2026-09-29 12:48'
labels:
  - mcp
dependencies: []
references:
  - >-
    /home/ecgtheow/Work/pos-cli-mcp-eval-archive/PLATFORMOS-CLI-MCP-EVAL-5.md
    (F3)
  - /home/ecgtheow/Work/pos-cli-mcp-eval-archive/ROUND-5-TRIAGE.md (D8)
modified_files:
  - lib/logRowId.js
  - mcp-min/logs/fetch.js
  - mcp-min/__tests__/logs.fetch.test.js
  - test/unit/log-row-id.test.js
  - docs/MCP_TOOLS.md
  - CLAUDE.md
priority: low
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`logs-fetch` answers an empty `since` read with `newestRow` — the newest row the instance actually holds — so a caller can tell "nothing matched in that window" from "this instance stopped writing to its log days ago". It does not answer a `lastId` read the same way.

That exemption is deliberate and was reasoned about: a tail polls at the tip of the stream and comes back empty most times it is called, so probing there would put an extra request on the common path to answer a question nobody asked.

Round 5 found the cost of the exemption. The instance under test had recorded nothing for four days. The evaluation's own summary of where it got stuck: *"Telling 'no log rows match' from 'the log is not being written'. The server gives a hint (newestRow), but the agent has to notice it, and it is missing from some responses."* The path that loses the signal is `lastId` — which is the path the tool's description tells callers to use for resuming.

A second, softer point from the same finding: when `newestRow` *is* returned and its timestamp is days old, the result states it and leaves the reading to the agent. Saying it plainly would cost a few bytes on the rare path that already costs an extra request.

Measure before changing. The original reasoning rests on a claim about frequency — that empty tail polls are the common case — which is testable against real usage rather than assumed. If the extra request is genuinely on the hot path, a cheaper signal than a second request may exist, since the read already knows the cursor it was given and the newest row it saw.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A caller resuming with lastId can tell an empty result caused by no new rows from one caused by a log that has stopped being written
- [x] #2 Whatever this costs on an empty tail poll is measured and written down, not assumed
- [x] #3 An ordinary tail poll that finds new rows costs no extra request
- [x] #4 When the newest row the instance holds is far older than the read, the result says so rather than leaving the agent to compare timestamps
- [x] #5 Tests cover an empty lastId read against a live log and against a stale one
- [x] #6 The behaviour matches what logs-fetch's description and docs/MCP_TOOLS.md say about newestRow
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The signal is free, so the exemption did not have to be traded away.

**The cursor already holds the answer.** A resume that read *no rows at all* has established exactly what a `newestRow` probe would ask: nothing has been written since that cursor. And a row id is a microsecond epoch, so how long that is comes out of the cursor itself. An empty `lastId` read now answers:

```javascript
{ logs: [], count: 0, lastId: "1790380009.486324",
  noRowsSince: { at: "2026-09-25T23:46:49.000Z", seconds: 304997 } }
```

**Measured, not assumed** — against fk-block on 2026-09-29, whose log has been frozen since 25 September, the same call before and after the change:

| | requests | `data` |
|---|---|---|
| before | 1 | `{logs: [], lastId, count: 0}` — 50 B |
| after | 1 | the same plus `noRowsSince` — 115 B |

**Zero extra requests, 65 bytes, and only on an empty resume.** AC #3 is satisfied by construction: no probe is ever added to the `lastId` path, so a tail poll that finds rows is untouched. The original reasoning for the exemption was right and is preserved.

**AC #4, both paths.** `newestRow` gains `ageSeconds`, so a `since` read that comes back with a row from four days ago says how long ago rather than leaving `now - created_at` to the agent — which is the arithmetic round 5 did by hand.

**Scope of the field, each part tested:** only when the read *scanned* nothing (rows read and rejected by a filter mean the log is alive), only on `lastId` (a `since` read is answered by `newestRow`; "nothing since the time you asked about" only restates the question), and only for a cursor naming an instant somebody chose — `"0"` and `"1"` do not produce one.

`epochSecondsOf` (`lib/logRowId.js`) is the one place a cursor is read, it takes only the integer part, and what it returns never goes back on the wire. CLAUDE.md's "nothing may parse the id" invariant now states that exception and why it is safe.

**A fixture was wrong and this found it.** `ROWS` in `logs.fetch.test.js` carried ids whose epochs disagreed with their own `created_at` by a day — invisible until something read the time out of an id. Corrected, with a comment saying the two have to agree.

Nine tests added, and seven mutations run against the suites — the field removed, reported when rows were filtered out, reported on a `since` read, reported for the two sentinels, `newestRow` losing `ageSeconds`, a non-row-id becoming an instant, and the fraction rounded into the seconds — each caught by a named test.

No tool description changed, so `tools/list` is unchanged. `docs/MCP_TOOLS.md` and the agent guide document both fields; the guide also now names the platform bug that freezes a log, since that is what makes the signal worth reading.

MCP suite 61 files / 1704 tests green; the five unit suites that touch row ids, 73 tests, green.
<!-- SECTION:FINAL_SUMMARY:END -->
