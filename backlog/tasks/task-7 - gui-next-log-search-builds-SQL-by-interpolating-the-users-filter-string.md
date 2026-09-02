---
id: TASK-7
title: gui/next log search builds SQL by interpolating the user's filter string
status: To Do
assignee: []
created_date: '2026-09-02 10:23'
labels:
  - security
  - gui
  - logs
dependencies: []
references:
  - gui/next/src/lib/api/logsv2.js
  - gui/next/src/lib/api/network.js
  - lib/server.js
  - lib/validation/schemas/gui.js
  - lib/proxy.js
priority: medium
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing on `master`, found while reviewing the Ajv validation branch.

`gui/next/src/lib/api/logsv2.js:33` builds an OpenObserve SQL statement by string-interpolating the free-text search box straight into three `ILIKE` predicates:

```js
if(filters.message){
  filters.sql = `SELECT * FROM logs where message ILIKE '%${filters.message}%' OR type ILIKE '%${filters.message}%' OR options_data_url ILIKE '%${filters.message}%'`;
}
```

Nothing escapes the value. A single quote in the search term terminates the literal, and everything after it is parsed as SQL. The statement is then POSTed to `/api/logsv2`, which `lib/server.js` forwards to `Gateway.logsv2` -> `this.client.searchSQL(params)`, so the crafted statement reaches OpenObserve with the developer's credentials attached.

Two things make this worth fixing rather than shrugging at:

- The GUI server sets `Access-Control-Allow-Origin: *` (`lib/server.js:97-101`), so `POST /api/logsv2` is reachable from any page open in the developer's browser while `pos-cli gui serve` is running, with an arbitrary `query.sql` — the client-side interpolation is the visible symptom, but the route accepts any statement regardless.
- The Ajv validation branch validates only the *top level* of the logsv2 payload (`query` must be an object or string). The real payload nests `sql`, `from`, `size`, `start_time`, `end_time` inside `query`, none of which are described, so the one place in this codebase with an actual injection surface is the one place validation does not reach.

Decide the model first, because it changes the fix. If arbitrary SQL from the browser is intended (it is a local developer tool pointed at the developer's own instance, and the Liquid evaluator already carries a "code executed here runs on the connected instance" warning), then say so explicitly in a comment on the route and at least escape the quote in the filter so the UI's own search box cannot produce a malformed or surprising query. If it is not intended, the filter has to be bound rather than interpolated, and `logsSearchSchema` needs to describe the nested `query` object so `sql` is constrained.

The same pattern appears in `gui/next/src/lib/api/network.js` for the network-log view.

Note `gui/next/build` is committed and shipped in the npm package, so any client-side change needs `npm run build` in `gui/next` and the built assets committed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A search term containing a single quote produces a well-formed query and cannot terminate the SQL string literal
- [ ] #2 The intended trust model for /api/logsv2 is recorded in a comment on the route in lib/server.js
- [ ] #3 If arbitrary SQL is not intended, logsSearchSchema describes the nested query object and constrains sql
- [ ] #4 The same treatment is applied to the network-log search in gui/next/src/lib/api/network.js
- [ ] #5 gui/next is rebuilt and the built assets committed if the client changed
<!-- AC:END -->
