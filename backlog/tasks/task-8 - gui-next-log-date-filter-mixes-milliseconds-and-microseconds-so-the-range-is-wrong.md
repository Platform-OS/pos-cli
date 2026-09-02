---
id: TASK-8
title: >-
  gui/next log date filter mixes milliseconds and microseconds, so the range is
  wrong
status: To Do
assignee: []
created_date: '2026-09-02 10:23'
labels:
  - bug
  - gui
  - logs
dependencies: []
references:
  - gui/next/src/lib/api/logsv2.js
  - gui/next/src/lib/api/network.js
priority: low
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing on `master`, found while reviewing the Ajv validation branch.

`gui/next/src/lib/api/logsv2.js:22-31` and the identical block in `gui/next/src/lib/api/network.js:23-30` compute the search window from the date picker:

```js
let date = new Date(filters.start_time);
date.setHours(23, 59, 59);

filters.end_time   = Math.floor(date.getTime() * 1000);                        // microseconds
filters.start_time = Math.floor(date.getTime() - 24 * 60 * 60 * 1000 * 3);     // milliseconds
```

`end_time` is converted to microseconds (which is what OpenObserve expects); `start_time` is left in milliseconds. It is therefore roughly a thousand times too small — around 1970 in microsecond terms — so the intended three-day window silently becomes "everything up to end_time". Picking a date does not narrow the result set the way the UI implies.

Two smaller things in the same block, worth settling while it is open: `date` is mutated by `setHours` before `start_time` is derived from it, so "3 days back" is measured from end-of-day rather than start-of-day; and the fixed 3-day lookback is not exposed anywhere in the UI, so a user selecting one date gets four days of logs with no indication.

`gui/next/build` is committed and shipped in the npm package, so this needs `npm run build` in `gui/next` and the built assets committed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 start_time and end_time are sent in the same unit that the logs backend expects
- [ ] #2 Selecting a date narrows the returned logs to the intended window, verified against a real instance or a recorded response
- [ ] #3 The window the date picker actually applies is either visible in the UI or documented in a comment
- [ ] #4 The identical block in gui/next/src/lib/api/network.js is fixed the same way
- [ ] #5 gui/next is rebuilt and the built assets committed
<!-- AC:END -->
