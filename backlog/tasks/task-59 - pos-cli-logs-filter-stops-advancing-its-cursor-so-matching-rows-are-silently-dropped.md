---
id: TASK-59
title: >-
  pos-cli logs --filter stops advancing its cursor, so matching rows are
  silently dropped
status: Done
assignee: []
created_date: '2026-09-23 18:13'
updated_date: '2026-09-23 19:07'
labels:
  - cli
  - logs
  - correctness
dependencies: []
references:
  - bin/pos-cli-logs.js
  - mcp-min/logs/fetch.js
  - lib/test-runner/logStream.js
modified_files:
  - bin/pos-cli-logs.js
  - test/unit/logs-tail.test.js
  - CHANGELOG.md
priority: medium
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three defects in `bin/pos-cli-logs.js`, all measured on 2026-09-23. The first is a real bug with silent data loss; the other two are cheap to fix while the file is open.

## 1. The cursor only advances on rows that pass the filter

```js
for (let k in logs) {
  const row = logs[k];
  if (this.filterByLogType(row)) continue;   // filtered rows skipped here...
  if (!storage.exists(row.id)) {
    storage.add(row);                        // ...so they never reach here, and lastId never moves
    this.emit('message', row);
  }
}
```

`storage.add` is what sets `storage.lastId`, and a row removed by `--filter` never reaches it. So between two matching rows the cursor does not move at all.

**Measured, driving the real binary against a fake instance** that serves five fresh non-matching rows per poll:

```
pos-cli logs --filter error   cursors asked for: ["0","0","0","0","0","0"]
pos-cli logs                  cursors asked for: ["0","1790200004.5","1790200014.5", …]
```

Six polls, thirty rows offered, and the filtered run asked for `last_id=0` every single time.

**Why that loses rows.** `/logs?last_id=0` returns the **newest 20 rows, oldest-first** — measured against a live instance by writing sequence-numbered rows: the window returned `03…30`, and after 25 more writes it returned `25…54`, so it slides. A filtered run is therefore pinned to a 20-row window of the newest rows. Anything that arrives and scrolls out of that window between two polls (default interval 3 s) is never examined, so a matching row in the gap is never printed. On a busy instance that means `--filter error` silently drops errors, which is the one thing it is used for.

This is the same defect `logs-fetch` already fixed (TASK-57). From CLAUDE.md: *"The cursor advances over every row read rather than only the ones returned, so a filtered read resumes after the rows it rejected."* The fix here is the same — advance the cursor over every row seen, and filter only what is printed.

**Note for whoever picks this up:** the cursor is *not* wrong in the unfiltered case. Rows arrive oldest-first, so `storage.lastId = item.id` on the last row is the newest and is correct. The ordering is fine; the filter interaction is the bug.

## 2. Every log row is kept in memory for the life of the process

```js
const storage = {
  logs: {},
  add: (item) => { storage.logs[item.id] = item; … },
  exists: (key) => storage.logs.hasOwnProperty(key)
};
```

`storage.logs` is only ever read through `hasOwnProperty` — the **values are never used**. It keeps whole row objects, messages and diagnostics included, for a command people leave running all day. A `Set` of ids is the same behaviour without the growth, which is what `lib/test-runner/logStream.js` now uses.

## 3. Desktop notifications can never fire

```js
const isError = (msg) => /error/.test(msg.error_type);
…
stream.on('message', ({ created_at, error_type, message, data }) => {
  if (isError(message)) {          // `message` is a string
```

`isError` reads `.error_type` off the destructured **message string**, which is always `undefined`, so the test is always false. No log row has ever taken that branch: `toasted-notifier` never fires, and the dependency is dead weight at runtime.

**Do not fix this by passing the row.** Both branches print with `logger.Info`, and only the `else` branch renders `data` — the structured Liquid diagnostic. Making `isError` work as written would stop error rows printing their diagnostic, which is the most useful part of an error. Whatever it becomes, the diagnostic has to print either way.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A --filter run advances its cursor over rows it rejected, so filtering changes what is printed and not how far the stream reads
- [x] #2 A test drives the command against a fake instance serving non-matching rows and asserts the cursor moves
- [x] #3 Dedup no longer retains whole log rows for the life of the process
- [x] #4 Error rows still print their structured diagnostic, whatever happens to isError and the desktop notification
- [x] #5 A decision is recorded on the notification: made to work, or removed along with the toasted-notifier dependency
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All three fixed. The command had **no test at all**; it has eight now.

## 1. The cursor

`seen` (a `Set` of ids) decides what has been handled and `newerOf` (`lib/logRowId.js`) decides the cursor, both updated **before** the filter runs. The filter now decides only what is printed.

```js
if (storage.exists(row.id)) continue;
storage.record(row);            // cursor advances over every row read
if (this.filterByLogType(row)) continue;
this.emit('message', row);
```

Verified against the stand-in instance: a `--filter` run that matches nothing now walks forward instead of asking `last_id=0` for ever.

## 2. The row store

`storage.logs` kept whole row objects and only its keys were ever read. It is a `Set` of ids, seeded `'0'`, and the id is never parsed.

## 3. The notification — decided, with a correction

Traced to commit `d92ebb3`, **30 July 2019**: the handler began destructuring the row, every other reference was updated (`title: msg.error_type` → `title: error_type`), but `isError(msg)` became `isError(message)` — the message **string**, whose `.error_type` is always `undefined`. Dead for six years, no report.

**I got the consequence wrong when I proposed the options, and the user corrected me from their own machine.** I claimed restoring `logger.Error` would avoid a notification per error row. It would not: `logger.Error` raises a desktop notification by default (`notify: true`, `lib/logger.js:84`), which is where the user's notifications were actually coming from — not from this dead branch. `logger.Error` accepts `notify: false`, so the chosen option was still reachable, just not the way I described it.

What shipped, per the decision *"restore the highlighting, drop the notification"*:

- `isError` takes the row's `error_type`.
- An error row prints through `logger.Error(text, { exit: false, hideTimestamp: true, notify: false })` — red again, no popup.
- **One printer per row.** `logger.Error` writes to stderr in both backends, so a row's detail block follows its line onto the same stream rather than being split across two.
- The diagnostic prints for **every** row. It used to live in the non-error branch, which an error row could never reach — so the compiler-style location of a Liquid failure was the one thing an error never showed.
- `toasted-notifier` stays in `package.json`: `lib/logger.js` still uses it. Only the unused import here went, along with `path`, `fileURLToPath` and `__dirname`, which existed solely for the notification icon.

**One behaviour change worth stating:** error rows move from stdout to stderr. That restores pre-2019 behaviour and is inherent to using `logger.Error`, but a script reading `pos-cli logs` on stdout will no longer see them. `pos-cli fetch-logs` is the command built for scripting.

## Testing

`test/unit/logs-tail.test.js`, 8 tests, driving the real binary against a local stand-in.

Bite-checked **twice**, because the fixture was rewritten after the first pass and the earlier results no longer counted:

| Breakage | Failed |
| --- | --- |
| the filed defect: filter gates the cursor | 1 |
| no dedup | 1 |
| `isError` back to the 2019 regression | 3 |
| diagnostic split onto the other stream | 1 |
| diagnostic never prints | 1 |
| cursor is the last row read, not the newest | 1 |

Two gaps found and closed by doing that honestly rather than declaring victory:

- **The first `isError` bite did not bite.** Nothing distinguished an error row's formatting. Errors go to stderr (`console.error`) and ordinary rows to stdout (`console.log`) in both backends, so the harness now separates the streams — and the revert fails three tests.
- **The cursor-ordering bite did not bite.** The fixture served rows in ascending order, where `newerOf` and "last row wins" are identical. A page arriving out of order now pins it.

**Flakiness found and fixed, not tolerated.** The suite passed alone and failed beside the others: it waited a fixed 1,200 ms, which is not enough under parallel load. Worse, the fixture keyed its pages off the *request count*, so new rows appeared whether or not the cursor moved — the thing asserted was decoupled from the thing under test. Both are gone: the harness runs until a stated condition holds (rejecting with the captured output at a 20 s cap), and the fixture serves rows **newer than the cursor it was given**. Three consecutive full `test/unit` runs are green apart from the known TASK-9 `modules.test.js` failure.

Also verified live against fk-block: error rows red on stderr, each diagnostic directly under its own line, no popups, and `--filter` both matching and matching-nothing behaving correctly.

## Noted, not changed

The poller fires on an interval without waiting for the previous response, so two polls in flight together can carry the same cursor. Harmless — `seen` drops the repeat — but it is why the tests assert that the cursor *moved* rather than that every cursor is distinct.
<!-- SECTION:FINAL_SUMMARY:END -->
