---
id: TASK-42
title: >-
  MCP: logs-fetch returns a lastId its own schema rejects, so paging has no
  correct input
status: To Do
assignee: []
created_date: '2026-09-22 06:44'
labels:
  - mcp
  - agent-facing
  - logs
dependencies: []
references:
  - mcp-min/logs/fetch.js
  - lib/proxy.js
priority: high
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by an agent-perspective evaluation of the MCP server (2026-09-21).

The tool's description says: *"Returns the rows and a lastId; pass that back to get only newer ones."* Its schema declares `lastId` as `{ type: "integer", minimum: 0 }`.

```
logs-fetch { env, limit: 5 }  →  "lastId": 1790008926.7639065     (a float)
                                  each row's own id: "1790008926.7639065"  (a string)

logs-fetch { env, lastId: 1790008926.7639065 }
→ { ok: false, error: { kind: "input", code: "INVALID_PARAMS",
                        message: "Invalid params: /lastId must be integer" } }
```

Truncating to `1790008926` is accepted and **re-delivers a row already seen**; symmetrically it can skip rows written within the same second.

**Three types for one identifier**: string in the rows, float in `lastId`, integer in the schema. `mcp-min/logs/fetch.js` stringifies the parameter on the way out (line ~29) and `Number()`s it on the way back (line ~66), which is where the precision goes.

The documented resume workflow therefore has no correct input, and tailing logs — the main reason to page them — cannot be done correctly. The error message itself is good; there is simply no value that satisfies it.

Two things the same evaluation found about this tool, cheap to fix here:

- **Nothing says which end `limit` takes from.** `lastId: 0` reads from the oldest end. For a log tool that is the first thing a caller needs to know.
- **Nothing says what the tool's scope is.** The evaluator wrote 13 rows with `{% log %}` through `liquid-exec` (`ok: true`) and `logs-fetch` returned two unrelated rows from three hours earlier. Whether `{% log %}` output is retrievable, and which streams are included, should be in the description.

Filtering is a separate, larger gap covered by TASK-28 (logsv2 search).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A lastId returned by the tool is accepted by the tool unchanged, and returns only newer rows
- [ ] #2 No row is delivered twice, and no row written in the same second is skipped
- [ ] #3 The description says which end limit reads from
- [ ] #4 The description says which log streams the tool covers, and whether {% log %} output is among them
- [ ] #5 A test pages twice against a fake and asserts the second page neither repeats nor skips
<!-- AC:END -->
