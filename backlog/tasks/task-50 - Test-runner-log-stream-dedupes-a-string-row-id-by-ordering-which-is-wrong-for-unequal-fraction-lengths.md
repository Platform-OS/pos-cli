---
id: TASK-50
title: >-
  Test runner log stream dedupes a string row id by ordering, which is wrong for
  unequal fraction lengths
status: Done
assignee: []
created_date: '2026-09-22 10:27'
updated_date: '2026-09-23 17:28'
labels:
  - logs
  - test-runner
  - correctness
dependencies: []
references:
  - lib/test-runner/logStream.js
  - mcp-min/logs/fetch.js
  - bin/pos-cli-logs.js
modified_files:
  - lib/test-runner/logStream.js
  - test/unit/test-log-stream.test.js
  - CHANGELOG.md
priority: low
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while fixing TASK-42, which established what a log row id actually is: a microsecond epoch the instance sends as a **string**, `"1790008926.7639065"`, with a fraction whose length varies — `"1790008519.397928"` has six digits, `"1790008926.7639065"` has seven, and a value ending in zeros is emitted short.

`lib/test-runner/logStream.js` carries the cursor as a number and then as a string, and dedupes by comparing the two:

```js
this.lastId = 0;                                        // line 19, a number
…
await this.gateway.logs({ lastId: this.lastId || 0 });  // line 70
…
if (this.lastId && row.id <= this.lastId) continue;     // line 77, mixed then string compare
this.lastId = row.id;                                   // line 78, now a string
```

After the first row, both sides are strings, so `<=` is **lexicographic**. That is right only while the fractions are the same length. They are not:

```
"1790008926.76"  <=  "1790008926.7600000"   → true  (a prefix sorts first)
 1790008926.76   <=   1790008926.7600000    → true, and they are the *same instant*
```

**Correction (2026-09-22):** an earlier version of this task illustrated the problem with `.76` against `.7639065` and claimed `.76` was the newer of the two. That is wrong — `0.76 < 0.7639065`, so string and numeric ordering agree there. Comparing fraction digits left to right *is* numeric comparison; the one case where it diverges is when a fraction is a **prefix** of the other, as above, where the shorter string sorts first while the two name the same instant. A `<=` guard then reads an already-handled row as newer and emits it twice; a `>` guard drops it.

`lib/logRowId.js` (added in TASK-58) has the correct comparison — it pads the shorter fraction before comparing, and never parses an id into a number. `isNewer`/`newerOf` are what this task should use if it keeps a comparison at all; dropping the comparison for a `Set`, as described below, removes the question entirely and is still the preferred fix.

**How bad, honestly: latent, not active.** `/logs?last_id=` is a strict greater-than (measured 2026-09-22), so every row in a response is already newer than the cursor and this guard should never fire. It is redundant belt-and-braces that is wrong in the one situation it exists for — a response that repeats or reorders rows. Filed because the luck is the server's, not ours, and because a dropped line in a test run looks like a test that did not log rather than a client that hid it.

**The fix the other two callers already use is not a comparison at all.** `logs-fetch` (`mcp-min/logs/fetch.js`) and `bin/pos-cli-logs.js` both keep a `Set` of ids already handled and never order them; the cursor is only ever handed back to the instance untouched. Doing the same here removes the question instead of answering it, and matches the rule TASK-42 put in CLAUDE.md: nothing between the instance and the caller may parse a row id.

`this.lastId || 0` on line 70 also becomes unnecessary once the seed is `'0'`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 logStream no longer orders two row ids to decide whether a row was seen
- [x] #2 The cursor it sends is the id string the instance gave it, never a number
- [x] #3 A test drives two rows whose fractions differ in length and asserts both are emitted
- [x] #4 The dedup still holds when a response repeats a row already handled
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed. `logStream` was the last of the four log readers still ordering a row id itself.

## What changed

`seen` (a `Set`) decides what has been handled; `newerOf` (`lib/logRowId.js`) decides the cursor. The seed is `'0'`, so `this.lastId || 0` is gone.

## Where this departs from the task, and why

The task preferred a `Set` **alone**, on the grounds that `logs-fetch` and `bin/pos-cli-logs.js` "both keep a `Set` of ids already handled and never order them". That description is no longer accurate for either:

- `logs-fetch` keeps a `Set` **and** orders, with `newerOf`, since TASK-58.
- `bin/pos-cli-logs.js` keeps an object keyed by id, and sets its cursor to **the last row iterated** — not the newest.

A `Set` alone leaves the same "last row wins" cursor here, and that is worse in this caller than in the other two. `logStream` only ever polls forward: a cursor that moves *backwards* on a page returned out of order never recovers, and the run reports a timeout at 180 s rather than the result it was waiting for. An interactive `pos-cli logs` tail has a person watching; `pos-cli tests run` does not.

So: `Set` for what has been handled, `newerOf` for the cursor — the `logs-fetch` arrangement. It is the same number of lines as `this.lastId = row.id` plus one import, so this is not extra machinery, it is the correct one-liner.

## Testing

New `test/unit/test-log-stream.test.js`, 6 tests. `fetchLogs` had **no test at all** before this; the existing `TestLogStream` tests cover only `isValidTestSummaryJson`, `parseJsonSummary` and `processLogMessage`.

Bite-checked, all four caught:

| Breakage | Failed |
| --- | --- |
| the original guard, verbatim (ordering decides dedup and cursor) | 4 |
| `Set` kept, cursor is the last row iterated | 1 |
| cursor ordered as a float | 1 |
| no dedup at all | 2 |

File restored and sha256-verified. `test/unit` is green apart from the known TASK-9 `modules.test.js` timeout; `test/integration/test-run.test.js` is 38/39, the one failure being the test that requires live credentials.

## Noted, not changed

Three things found while doing this, all outside the acceptance criteria:

1. **`bin/pos-cli-logs.js` has the same cursor weakness** — `storage.lastId = item.id` takes the last row added rather than the newest — and it also keeps **every row object** in `storage.logs` for the life of the process, which for a long-running tail is unbounded memory. Worth its own task.
2. **`seen` here grows for the life of the stream** (bounded by `ASYNC_TEST_TIMEOUT_MS`, 180 s). Acceptable — id strings only, and the process exits after the run — but it is not free on a very chatty suite.
3. **The existing `TestLogStream` unit tests live in `test/integration/test-run.test.js`** although they need no instance, so they do not run under `npm run test:unit`. The new tests are in `test/unit`; moving the old ones was out of scope.
<!-- SECTION:FINAL_SUMMARY:END -->
