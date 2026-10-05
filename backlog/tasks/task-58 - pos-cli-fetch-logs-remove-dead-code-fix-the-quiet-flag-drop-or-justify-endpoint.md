---
id: TASK-58
title: >-
  pos-cli fetch-logs: remove dead code, fix the quiet flag, drop or justify
  --endpoint
status: Done
assignee: []
created_date: '2026-09-22 17:22'
updated_date: '2026-09-22 20:40'
labels:
  - cli
  - logs
  - correctness
  - security
dependencies: []
modified_files:
  - bin/pos-cli-fetch-logs.js
  - lib/logRowId.js
  - mcp-min/logs/fetch.js
  - test/unit/fetch-logs.test.js
  - test/unit/log-row-id.test.js
  - README.md
  - CHANGELOG.md
priority: medium
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`bin/pos-cli-fetch-logs.js` is the non-interactive counterpart to `pos-cli logs`: it pages `/logs` and writes one JSON object per line, then exits. It works — verified against a live instance on 2026-09-22 — and it is what `docs/MCP_COVERAGE.md` records as the CLI front end for the same capability the MCP `logs-fetch` tool exposes.

Four defects found while reading it. The first two are trivial; the third is a judgement call; the fourth is shared with TASK-50.

## 1. Dead code, lines 27–31

```js
let lastId = options.lastLogId || options.lastLogId === 0 ? options.lastLogId : (options.lastLogId || options.lastLogId === 0 ? options.lastLogId : (options.lastLogId || options.lastLogId === 0 ? options.lastLogId : (options.lastLogId)));
// commander converts option name to camelCase: lastLogId
lastId = options.lastLogId || options.lastLogId === 0 ? options.lastLogId : (options.lastLogId);
// fallback to the provided --last-log-id
if (!lastId && options['last-log-id']) lastId = options['last-log-id'];
```

Three nested ternaries that all evaluate to `options.lastLogId`, written out, then written again, then a lookup of `options['last-log-id']` which commander never populates because it camel-cases option names. The whole block is `const lastId = options.lastLogId;`.

## 2. `-q` never suppresses anything

```js
catch (err) {
  if (!program.quiet) console.error('Error fetching logs:', err.message || err);
```

`program` is the imported commander program, not the parsed options for this action, so `program.quiet` is always `undefined` and the branch always runs. The parsed flag is `options.quiet`.

## 3. `--endpoint <url>` redirects the API base while still sending the `.pos` token

```js
if (options.endpoint) { authData.url = options.endpoint; }
```

This is the parameter class `CLAUDE.md` records as removed from every MCP tool: *"`endpoint` replaced the URL while the `.pos` token was still sent, so a name a model read somewhere could redirect this machine's credentials."* On a CLI the operator is choosing it themselves, so the severity is lower — but it is the last one left in the codebase, it is undocumented in the README, and nothing warns that the stored token travels to whatever host is named.

Decide: remove it, or keep it and say plainly in `--help` that it sends your instance token to the URL you give it.

## 4. Row ids are compared as floats

```js
if (!isNaN(Number(row.id)) && Number(row.id) > Number(maxId)) { maxId = row.id; }
```

A row id is a microsecond epoch with up to 17 significant digits, which is the edge of what a double holds. If two adjacent ids collapse to the same value the cursor does not advance, the `maxId === latestId` check ends the loop, and the fetch stops early with no indication it was incomplete.

This is the same class as TASK-50, whose description says `logs-fetch` and `bin/pos-cli-logs.js` avoid it by keeping a `Set` and never ordering ids. That is true of their **dedup**; both still pick `maxId` by numeric comparison, and `fetch-logs` does too. Worth fixing in one place across all three, so TASK-50 should probably absorb this or run alongside it.

## Not a defect, but worth noting

There is no `--limit`: it pages until the log is exhausted. On a busy instance that is unbounded output and unbounded time, with no way to ask for just the recent rows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The lastId block is one assignment, and a test covers --last-log-id being honoured
- [x] #2 -q suppresses the error line, read from the parsed options rather than the program object
- [x] #3 A decision is recorded on --endpoint: removed, or kept with --help saying it sends the stored instance token to the host named
- [x] #4 Row ids are no longer ordered as floats anywhere in the paging loop, consistent with whatever TASK-50 settles for logStream
- [x] #5 A fetch that stops early is distinguishable from one that reached the end of the log
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All four defects fixed, plus two found while fixing them.

**1 & 2 — dead code and `-q`** (done earlier). The `lastId` block is one assignment; the catch reads `options.quiet` rather than `program.quiet`.

**4 — float ordering.** New `lib/logRowId.js` exports `isNewer` / `newerOf`, which compare the digits and never parse an id: whole parts by width then by value, fractions padded to equal length and compared by position. `bin/pos-cli-fetch-logs.js` and `mcp-min/logs/fetch.js` both use it — the MCP tool carried the identical `Number(row.id) > Number(maxId)` comparison.

**5 — early stop.** An instance answering with entries but none newer than the cursor cannot be paged further. That now writes `Stopped early at <id>` to stderr, so a short read is distinguishable from reaching the end of the log. Exit code is deliberately still 0: stdout is valid NDJSON either way, and changing the exit contract would break existing scripts silently. `-q` suppresses it.

**3 — `--endpoint`: kept, with its behaviour stated.** Removing it would contradict the decision already recorded in this release's CHANGELOG ("on the command line a person chooses the host"), and the env-var path is not equivalent — `--endpoint` deliberately keeps the stored credential. It now says so in `--help`, in the README, and on stderr when used, naming the host the token is being sent to.

**Also fixed, found while doing the above**

- **The README example taught the defect.** It showed `{"id":"1001", ..., "type":"debug"}`. A real row carries a decimal microsecond-epoch `id` and `error_type`. Anyone following it would build exactly the integer cursor this task is about. The section now has real rows, a table of the options, and an explicit warning that the id is a decimal string to be passed back unchanged.
- **TASK-50's worked example is arithmetically wrong** and would have misled whoever implemented it. It claimed `1790008926.76` is newer than `1790008926.7639065`; it is not — `0.76 < 0.7639065`, so string and numeric ordering agree in that case. Comparing fraction digits left to right *is* numeric comparison. The one case where they diverge is when one fraction is a **prefix** of the other (`.76` vs `.7600000`), where the shorter string sorts first although both name the same instant. TASK-50 has been corrected and now points at `lib/logRowId.js`.

**Testing**

`test/unit/log-row-id.test.js` (22 tests) and 6 more in `test/unit/fetch-logs.test.js` (4 → 10). Both suites green; full runs are mcp-min 1566 and test/unit 1368 passing, with only the pre-existing TASK-9 `modules.test.js` failure.

Bite-checked by breaking the code five ways: cursor compared as floats again, fractions compared without padding, whole parts compared without the width check, the early-stop warning removed, the endpoint warning removed. Four failed immediately. **The fifth did not** — the width check was covered by a case that passes lexicographically anyway, since a longer string sharing a prefix already sorts higher. Added `10000000000.0` against `9999999999.0`, where the larger number has the smaller leading digit, which is the only situation the width check exists for; it bites now. Both files restored and verified by hash.

**Not done**

No `--limit`. It still pages to the end of the log. Left as noted in the description rather than added, since it is a feature rather than a defect and the MCP `logs-fetch` tool now covers bounded reads (TASK-57).
<!-- SECTION:FINAL_SUMMARY:END -->
