---
id: TASK-50
title: >-
  Test runner log stream dedupes a string row id by ordering, which is wrong for
  unequal fraction lengths
status: To Do
assignee: []
created_date: '2026-09-22 10:27'
labels:
  - logs
  - test-runner
  - correctness
dependencies: []
references:
  - lib/test-runner/logStream.js
  - mcp-min/logs/fetch.js
  - bin/pos-cli-logs.js
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
"1790008926.76"  <=  "1790008926.7639065"   → true  (a prefix sorts first)
 1790008926.76   <=   1790008926.7639065    → false (it is 0.0000935 s newer)
```

So a row at `.76` arriving after one at `.7639065` reads as already-seen and its log line is dropped from a test run's output.

**How bad, honestly: latent, not active.** `/logs?last_id=` is a strict greater-than (measured 2026-09-22), so every row in a response is already newer than the cursor and this guard should never fire. It is redundant belt-and-braces that is wrong in the one situation it exists for — a response that repeats or reorders rows. Filed because the luck is the server's, not ours, and because a dropped line in a test run looks like a test that did not log rather than a client that hid it.

**The fix the other two callers already use is not a comparison at all.** `logs-fetch` (`mcp-min/logs/fetch.js`) and `bin/pos-cli-logs.js` both keep a `Set` of ids already handled and never order them; the cursor is only ever handed back to the instance untouched. Doing the same here removes the question instead of answering it, and matches the rule TASK-42 put in CLAUDE.md: nothing between the instance and the caller may parse a row id.

`this.lastId || 0` on line 70 also becomes unnecessary once the seed is `'0'`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 logStream no longer orders two row ids to decide whether a row was seen
- [ ] #2 The cursor it sends is the id string the instance gave it, never a number
- [ ] #3 A test drives two rows whose fractions differ in length and asserts both are emitted
- [ ] #4 The dedup still holds when a response repeats a row already handled
<!-- AC:END -->
