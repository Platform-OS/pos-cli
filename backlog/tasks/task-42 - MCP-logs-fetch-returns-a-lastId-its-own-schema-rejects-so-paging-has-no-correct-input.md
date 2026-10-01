---
id: TASK-42
title: >-
  MCP: logs-fetch returns a lastId its own schema rejects, so paging has no
  correct input
status: Done
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 10:00'
labels:
  - mcp
  - agent-facing
  - logs
dependencies: []
references:
  - mcp-min/logs/fetch.js
  - lib/proxy.js
modified_files:
  - mcp-min/logs/fetch.js
  - lib/validation/schemas/gui.js
  - mcp-min/__tests__/logs.fetch.test.js
  - mcp-min/__tests__/validate-params.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - test/unit/server.validation.test.js
  - CLAUDE.md
  - CHANGELOG.md
  - docs/MCP_TOOLS.md
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
- [x] #1 A lastId returned by the tool is accepted by the tool unchanged, and returns only newer rows
- [x] #2 No row is delivered twice, and no row written in the same second is skipped
- [x] #3 The description says which end limit reads from
- [x] #4 The description says which log streams the tool covers, and whether {% log %} output is among them
- [x] #5 A test pages twice against a fake and asserts the second page neither repeats nor skips
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured the endpoint before changing anything. Against the live instance on 2026-09-22:

- a row id is a **string**, a microsecond epoch: `"1790008926.7639065"`;
- `last_id` takes that full value and is a **strict greater-than** — `last_id=<first id>` returned
  exactly the one newer row;
- truncating to `1790008519` returned both rows, which is the re-delivery the report describes;
- rows come back ascending, and `/logs` answered nothing at all for a `{% log %}` write or a Liquid
  error, over four and then eight seconds. Rows carry `error_type`, so this is the instance error
  log — the stream `pos-cli logs` tails — and not a general log stream. That is what the
  description now says, since the evaluation lost a detour to exactly that.

So the fix is to stop converting the cursor, not to convert it more carefully: `lastId` is the
string the instance sent, at every step, and the schema accepts that string.

**The same defect was one layer over, in the GUI, and its own schema comment pointed at it.**
`logsRequestSchema` declared `lastId` an `integer` and said "both are normalised to integer so the
cursor has one type across the codebase" — that normalisation is the bug. The admin Logs page polls
with `logs.at(-1).id`, so every poll after a row had arrived was a 400 and the tail stopped
advancing. Fixed with the same shape, exported as `ROW_ID` and imported by the tool, so the claim
that comment makes is now true.

`ROW_ID` is a pattern rather than a bare string on purpose, and that is a deliberate reversal of my
first design. Unconstrained was the tempting answer — the whole task is about over-constraining a
value we do not mint — but `server.validation.test.js` pins that a cursor carrying its own query
parameters is refused, and dropping the type without replacing it would have quietly widened that.
The pattern accepts every id the platform emits, integer or fractional, and still refuses
`1&admin=true`; `Gateway.logs` encodes the value as well, so that is two guards rather than one.

**A round-trip test already existed and passed straight through the bug.** `validate-params.test.js`
checked that the published schema accepts the published cursor, using rows of `{ id: 41 }` — an
integer survives `Number()` and satisfies an `integer` schema, so the fixture agreed with the
defect. Fixture replaced with a real id and the reason recorded above it. The new
`logs.fetch.test.js` routes every call through `rejectionFor` before `runTool`, because `runTool`
does not validate and a test that skipped the gate would have passed on the broken schema too.

Not changed: `limit` still counts from the oldest row after the cursor, because reading forward is
all `/logs?last_id=` offers — there is no "most recent N" to be had here. Documented instead, in
the tool description, the `limit` parameter and `docs/MCP_TOOLS.md`, with the tail recipe. Recency
and filtering are TASK-28's (logsv2 search, which has a time range).

Byte budgets: bare `tools/list` 17,962 → 18,157, and the dev profile budget consolidated into one
raise to 6,800 (it is at 6,680) rather than the two separate bumps TASK-41 and TASK-42 would each
have made — both purchases are the same one, an evaluation finding a description that was not true.

Verified live end to end after the change: page one row, hand the `lastId` back through the
validator, get exactly the next row, then nothing. 21 deliberate reverts, sha256-verified restore,
all caught — including one that had to be redesigned: removing the no-progress guard hung the suite
instead of failing it, so the stuck-instance fake now gives up after three pages.

mcp-min 1475 passing across 61 files; test/unit 1330 with the pre-existing TASK-9 failure only.
<!-- SECTION:NOTES:END -->
