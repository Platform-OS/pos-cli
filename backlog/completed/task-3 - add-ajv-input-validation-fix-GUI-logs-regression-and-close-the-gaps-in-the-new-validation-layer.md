---
id: TASK-3
title: >-
  add-ajv-input-validation: fix GUI logs regression and close the gaps in the
  new validation layer
status: Done
assignee: []
created_date: '2026-09-02 10:21'
updated_date: '2026-09-02 14:17'
labels:
  - bug
  - validation
  - mcp
  - gui
  - security
dependencies: []
references:
  - lib/validation/index.js
  - lib/validation/schemas/gui.js
  - lib/server.js
  - mcp-min/validate-params.js
  - mcp-min/schemas/auth.js
  - mcp-min/tools.js
  - mcp-min/http-server.js
  - mcp-min/stdio-server.js
  - gui/next/src/lib/api/logs.js
  - gui/next/src/routes/logs/+page.svelte
  - CLAUDE.md
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Branch `add-ajv-input-validation` (commits fe9f93c, 8dd89bd) adds Ajv JSON Schema validation on the MCP transports (stdio + HTTP), on `mcp-min/tools.config.json`, and on the GUI server routes, as input-validation evidence for the SOC2 audit. It also relaxes `required: ['env']` on tools that authenticate, because `resolveAuth` supports three other call styles.

The design is right and should not change: validating each MCP tool's own `inputSchema` means the schema advertised in `tools/list` and the schema enforced are the same object, so there is no second definition to drift. `allowUnionTypes` is genuinely required (verified: `logsSearchSchema.query` is the only schema that needs it). The new tests do bite — six independent mutations of the production code each broke tests as intended.

Everything below lives in the code and tests this branch introduces. It is one task because shipping any of it would either break a user-visible feature or leave the branch's own stated contract unenforced.

## 1. Blocker: the admin GUI Logs page returns 400 on every load

`lib/validation/schemas/gui.js` types the log cursor as `{ type: 'integer', minimum: 0 }`. The client that actually calls the route (`gui/next/src/lib/api/logs.js:18-20`) sends the literal string `null` when there is no cursor:

```js
const last = args.last ?? null;
return fetch(`${url}?lastId=` + last)   // -> ?lastId=null
```

`routes/logs/+page.svelte:41` seeds that value from `$state.logs.logs?.at(-1)?.id ?? null`, so the first poll always sends it. Ajv does not coerce `"null"` to an integer. Verified against a running `lib/server.js`:

```
GET /api/logs?lastId=null -> 400 {"error":"Invalid request: /lastId must be integer"}
```

`logs.get` swallows the rejection into `{ error }`, so the page renders empty with no indication why. `?lastId=` (empty) is rejected the same way.

The schema comment in `gui.js:56` shows the root cause: the constraint was derived from `lib/test-runner/logStream.js` rather than from the client that calls the route. The preferred fix is client-side (`args.last ?? 0` — `0` is already the "from the beginning" sentinel that `logStream.js` uses) plus a `gui/next` rebuild, since `gui/next/build` is committed and shipped in the npm package. Normalising empty/`null`/`undefined` away inside the route is acceptable only as a compatibility shim for already-installed GUI builds, and must be commented as such.

The same field is typed `integer` here but `string` in `mcp-min/logs/fetch.js:15` and `mcp-min/logs/stream.js`. Pick one, or document why they differ.

## 2. The "one schema, no drift" claim is broken by a third default

Three different objects now describe "this tool declares no schema": `{ type: 'object', properties: {} }` in the stdio tools/list (`stdio-server.js:52`), `{ type: 'object', additionalProperties: true }` in the HTTP tools/list (`http-server.js:175`), and `{ type: 'object' }` in the enforcement path (`validate-params.js:6`). The first two predate the branch; the branch added the third, which is the one actually enforced. Hoist a single exported constant and use it at all three sites. `envs-list` (`mcp-min/tools.js:100`) is the only tool without `additionalProperties: false` — now that schemas are enforced, close it like the others.

## 3. `validate()` mislabels two non-schema failures as schema-compile failures

`result.schemaError` maps to HTTP 500 / JSON-RPC `-32603` at four call sites. Two failures are wrongly routed there:

```
validate({type:'object'}, {}, {mode:'nope'}) -> schemaError: "Schema failed to compile: Unknown validation mode: nope"
validate(true, {x:1})                        -> schemaError: "Schema failed to compile: Invalid value used as weak map key"
```

The first is a caller programming error, not a schema defect. The second is a *legal* boolean JSON Schema that dies in the WeakMap cache at `lib/validation/index.js:45` because primitives cannot be WeakMap keys. Neither is reachable from today's schemas; both are traps for the next person. Also, `validate()` returns a `data` field that no caller reads — drop it or use it.

## 4. The `env`-optional rule is unenforced for 15 of 22 tools

CLAUDE.md states that any tool closing its schema with `additionalProperties: false` must also declare `url`/`email`/`token`, or the explicit-credentials path in `resolveAuth` becomes unreachable. Every tool satisfies this today (checked all 22 that call `resolveAuth`), but the test that guards it (`mcp-min/__tests__/validate-params.test.js:64-72`) uses a hand-written list of 7 tool names. Proof the guard does not hold: stripping `url`/`email`/`token` from `mcp-min/migrations/list.js` — a tool that calls `resolveAuth` — leaves all 338 mcp-min tests passing. Replace the list with an invariant derived from the tool registry so tools added later are covered automatically.

Related: `mcp-min/schemas/auth.js` is applied to only 6 tools (`constants/*`, `data/import*`, `uploads/push`); the other 16 duplicate the three properties inline and, unlike the shared fragment, ship no `description` for them, so `tools/list` documents the same parameters inconsistently. Apply the fragment everywhere or delete it.

## 5. `ajv-formats` is a dead runtime dependency

`addFormats(ajv)` is called but no schema in the repo uses the `format` keyword (`mcp-min/check/index.js:17` is a property *named* `format`, not the keyword). Either drop the dependency or use it — `format: 'email'` / `'uri'` on the shared auth properties is the obvious missing half, given `lib/validators/email.js` and `lib/validators/url.js` already enforce that for CLI arguments.

## 6. "The tools config fails closed" is only half true

A config naming a tool that does not exist is silently ignored, which is exactly the outcome the new throw was added to prevent. Verified: `MCP_TOOLS_CONFIG = {"tools":{"deploy-strt":{"enabled":false}}}` starts the server with `deploy-start` still enabled and all 35 tools exposed. The schema cannot catch this because it cannot enumerate tool names; `applyConfig` (`mcp-min/tools.js:183`) iterates the registry and never inspects config keys. Add a pass over `Object.keys(config.tools)` that rejects (or at minimum loudly warns about) names with no matching tool.

Separately, the throw itself reaches the user as a raw Node stack trace, doubled with the `log.error` line above it (`[ERROR] invalid tools config at …` followed by `Error: Invalid tools config at …` and 6 module-loader frames). Exit code is 1, which is correct, but the output contradicts CLAUDE.md's own error-handling guidance ("user-friendly error messages… log to logger for consistent formatting"). Catch at the `bin/pos-cli-mcp.js` boundary and report through `logger.Error`.

## 7. Documented `resolveAuth` precedence is wrong

The new CLAUDE.md section states the order as "explicit params, then `MPKIT_*` env vars, then the named `.pos` environment, then the first `.pos` entry". `mcp-min/auth.js:33-56` actually resolves: explicit params -> **named `.pos` environment** -> `MPKIT_*` -> first `.pos` entry. The same wrong order appears in the comment at `mcp-min/__tests__/validate-params.test.js:61`. CLAUDE.md is the file future agents follow, so this needs to be right. (The stale JSDoc in `auth.js` it was copied from is tracked separately.)

Also worth a line in the affected tool descriptions: because `env` is now advertised as optional, an MCP client that omits it lands on the *first* `.pos` entry for mutating tools (`data-import`, `constants-set`, `uploads-push`). Runtime behaviour is unchanged — nothing enforced `required` before — but the advertised contract now invites the omission.

## 8. Coverage gaps in the new tests

- The `schemaError` -> 500 / `-32603` branch is untested at all four call sites.
- `test/unit/validation.test.js:89` ("compiles each schema once and reuses it") validates twice and asserts both are valid. It asserts nothing about caching.
- In `mcp-min/__tests__/tools-config-validation.test.js`, the `test.each` case for a bare `null` config passes for the wrong reason: with the throw removed it still fails, because `applyConfig` then dereferences `null`. Only the `false`/`0`/`""` cases exercise the fail-closed check the comment describes.
- No coverage for: stdio legacy direct invocation (`stdio-server.js:171-181`, including its non-JSON-RPC `send({ id, error })` shape), `/call-stream` legacy streaming validation (`http-server.js:229-234`), `logsv2` `query` as an object (the actual `gui/next` payload) or as a string (the union that forced `allowUnionTypes`), and POST-body coercion on `/api/logsv2` despite the comment at `lib/server.js:127-128` claiming it.
- `transport-validation.test.js:15` hardcodes port 5931 while sibling suites use 5920/5930/5940. `startHttp` resolves with the server, so `port: 0` plus `server.address().port` removes the collision class.
- Schema assertions are split between `.toBeUndefined()` and `.not.toContain('env')` for the same intent; the `required` relaxations on `data-validate` and `unit-tests-run` have no assertion at all.

## 9. Style

Two lines added to `mcp-min/http-server.js` exceed the 120-char `.editorconfig` limit: the `respond({ error: { code, … } })` call in JSON-RPC `tools/call` (128) and the `/call-stream` rejection (129).

## Suite status at time of review

On the lockfile-pinned `ajv@8.20.0` / `ajv-formats@3.0.1`: the five new/changed test files 80/80 pass; `mcp-min/__tests__` 338/338 pass; `test/unit` 1153 pass with 1 failure (`modules.test.js > publishVersion() … single-dir workflow` times out, reproduced identically on a clean `master` worktree — tracked separately).

Note: `ajv`/`ajv-formats` were absent from the project's `node_modules` during review — `npm install` had never been run after they were added, so everything resolved from an unrelated `~/node_modules/ajv@8.18.0`. Run `npm ci` first. `npm run pretest` also rewrites `test/fixtures/yeoman{,/custom}/package-lock.json`; revert those before committing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /api/logs accepts the cursor shape gui/next actually sends, and the admin Logs page populates on first load with no 400 response
- [x] #2 The log cursor is typed consistently across lib/validation/schemas/gui.js, mcp-min/logs/fetch.js and mcp-min/logs/stream.js, or the divergence is documented in the schema
- [x] #3 A single shared constant describes the no-schema default, used by both tools/list responses and the enforcement path in validate-params.js
- [x] #4 The envs-list tool schema is closed with additionalProperties: false like every other tool
- [x] #5 validate() distinguishes an unknown mode and a boolean schema from a schema compile failure, and neither is reported as 500 / -32603
- [x] #6 validate() no longer returns a field that no caller reads
- [x] #7 Removing url, email or token from the schema of any tool that calls resolveAuth fails the test suite (today: stripping them from mcp-min/migrations/list.js leaves all 338 mcp-min tests passing)
- [x] #8 mcp-min/schemas/auth.js is spread into every tool with a closed schema that authenticates, or removed in favour of the inline declarations
- [x] #9 ajv-formats is used by at least one schema or removed from package.json dependencies
- [x] #10 A tools.config.json entry naming a tool that does not exist is rejected or loudly warned about, so the fail-closed guarantee in CLAUDE.md holds
- [x] #11 An invalid tools config reports through logger with a user-facing message and exits non-zero, with no raw Node stack trace
- [x] #12 CLAUDE.md and the comment in validate-params.test.js state resolveAuth's actual precedence: explicit params, named .pos environment, MPKIT_* env vars, first .pos entry
- [ ] #13 The schemaError branch is covered by a test at each of the four sites that maps it to 500 / -32603
- [x] #14 No vacuous assertions remain in the new suites: the compile-once test either verifies that Ajv compiles a schema once, or is removed
- [x] #15 The bare-null tools-config case fails because validation rejected the config, not because applyConfig dereferenced null
- [x] #16 Validation is covered for the stdio legacy direct-invocation path, the /call-stream legacy streaming path, logsv2 query-as-object and query-as-string, and POST-body coercion on /api/logsv2
- [x] #17 transport-validation.test.js binds an ephemeral port rather than a hardcoded one
- [x] #18 Schema assertions use one consistent style, and the required relaxations on data-validate and unit-tests-run are asserted
- [ ] #19 No line added by this branch exceeds the 120-character limit in .editorconfig
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified at commits dfdd3ab ("fix GUI logs regression and close gaps in the validation layer") and a16db70 ("fix cursor round-trip and prototype-chain hole in config validation"). 17 of 19 acceptance criteria met; 2 carried forward, detailed below.

## Blocker fixed and verified end to end

Fixed on both sides: `gui/next/src/lib/api/logs.js` now sends `args.last ?? 0`, and `lib/server.js` strips `'null'`/`'undefined'`/`''` from the cursor before validating, with a comment naming it a shim for GUI builds already installed and stating the condition for removing it. `logsRequestSchema` gained `default: 0` so an absent cursor no longer interpolates `"undefined"` upstream.

Probed against a real `lib/server.js` listener (a fake upstream, so 502 = passed validation and attempted the request):

```
?lastId=null   (what the SHIPPED gui/next/build still sends)  502
?lastId=0      (what the fixed source sends)                   502
?lastId=42     (subsequent poll)                               502
(no param)                                                     502
?lastId=1&admin=true                                           400  /lastId must be integer
?lastId=newest                                                 400  /lastId must be integer
?lastId=-1                                                     400  /lastId must be >= 0
```

Note `gui/next/build` was deliberately not rebuilt — the shipped bundle still contains `c.last??null`, confirmed by grep. The shim is therefore what actually fixes the page for users today, and the source fix is dormant until someone runs `npm run build` in `gui/next`. That is the right trade (a SvelteKit rebuild would churn every hashed asset filename), it is documented in the code, and both shapes are covered by tests.

## Verified by mutation, not just by reading

Each mutation applied to production code, suite run, mutation reverted:

- strip `...authProperties` from `mcp-min/migrations/list.js` (a tool the old hand-written list never named) → 2 failures, one naming the file. The invariant now scans `mcp-min/**` for `resolveAuth(` with fast-glob, so a tool added later is covered the moment it authenticates. This was the escape proven in the review.
- flatten `rejectionFor`'s status mapping to a constant 400 / -32602 → 4 failures, one per MCP dispatch path.
- flatten `rejectInvalid`'s mapping in `lib/server.js` to a constant 400 → **0 failures**. See carried-forward item below.

## Criterion-by-criterion

1, 2 — cursor accepted in every shape the GUI sends; typed `integer` consistently in `gui.js`, `mcp-min/logs/fetch.js` and `mcp-min/logs/stream.js`.
3, 4 — `OPEN_OBJECT_SCHEMA` in the new `mcp-min/schemas/default.js`, imported by both `tools/list` responses and `validate-params.js`; `envs-list` closed with `additionalProperties: false`.
5, 6 — unknown mode now throws `RangeError`; boolean schemas skip the WeakMap and validate normally; `data` removed from the return. All three asserted.
7, 8 — every one of the 22 `resolveAuth` tools spreads `authProperties`; no inline `url`/`email`/`token` triple remains anywhere.
9 — `ajv-formats` is now earned: `format: 'uri'` and `format: 'email'` on the shared auth properties. This matches `lib/validators/url.js`, which already requires a parseable absolute URL, so the CLI and MCP surfaces now agree.
10, 11 — `loadToolsConfig` rejects config keys matching no registered tool, using `hasOwnProperty` rather than `in` (with the reasoning in a comment), and names every unknown key. New `ToolsConfigError` caught at the `bin/pos-cli-mcp.js` boundary and reported through `logger`; a test asserts exit 1, the message present, and no stack frames or `node:internal` in the output.
12 — CLAUDE.md now states the real precedence (params → named `.pos` → `MPKIT_*` → first entry) and adds the first-`.pos`-entry warning to the descriptions of `data-import`, `constants-set`, `constants-unset` and `uploads-push` in `tools.config.json`.
14 — the compile-once test now counts schema property reads through a Proxy and asserts the second call reads nothing. It actually measures caching.
15 — the bare-`null` config case now asserts `must be object` and `not.toContain('TypeError')`, so it can no longer pass on the incidental `applyConfig` crash.
16 — added: stdio legacy direct invocation in both its JSON-RPC and bare `{ id, error }` shapes, `/call-stream` legacy streaming (including a `content-type: application/json` assertion, proving rejection precedes the SSE handshake), `logsv2` query-as-object and query-as-string, scalar-into-string-union coercion, a union miss, POST-body coercion, and a `searchAround` payload.
17 — `startHttp({ port: 0 })` with `server.address().port`.
18 — `required` assertions are now uniformly `toEqual([...])` or `toBeUndefined()`, plus a dedicated "required relaxations" block covering `data-validate` and `unit-tests-run`.

## Found and fixed beyond the task

Tightening `logs-fetch.lastId` to `integer` (criterion 2) would have broken the tool's own paging: the handler returned the cursor as a string, which the schema it advertises would then reject with -32602. The fix returns `Number(latestId)` and adds a round-trip test that feeds the returned cursor back through validation. `latestId` is only ever assigned a numeric string, so there is no NaN path.

Worth a release note: `logs-fetch.lastId` and `logs-stream.startLastId` changed type from `string` to `integer`, and `envs-list` now rejects unknown parameters. MCP clients read `tools/list` per session so they adapt automatically, but a hard-coded caller sending `lastId: "42"` will now get -32602.

## Carried forward

**Criterion 13 — partially met.** Three of the four `schemaError` sites are genuinely covered via a test-only tool with an uncompilable schema, mutation-verified. The GUI leg is not: the "uncompilable schema on a GUI route" block in `test/unit/server.validation.test.js` builds a throwaway express app and reimplements the status expression inline, so it never exercises `lib/server.js`. Flattening the real `rejectInvalid` mapping to 400 passes all 32 tests in that file. Tracked as TASK-3.1. Left as a follow-up rather than a blocker because no schema in the repo fails to compile, so the branch is unreachable in practice — it is regression protection for a rule CLAUDE.md itself notes is written in two places.

**Criterion 19 — deviation accepted.** Both code lines originally flagged in `mcp-min/http-server.js` are now within 120 characters. Four new lines exceed it, all of them single-quoted `description:` string literals in tool definitions, in files where `master` already carries description lines of 150–320 characters (`liquid/exec.js:7` is 317). Wrapping them would need string concatenation that no other tool uses. Flagged rather than silently accepted; reopen if the repo ever adopts a linter that enforces `.editorconfig`.

**One stale comment.** `lib/validation/schemas/gui.js` still reads "The same field is declared `integer` here but `string` on the MCP logs tools" — both are now `integer`, which the same sentence goes on to say. Reads as a description of the change rather than of the code. Cosmetic.

**Docs/test tension.** CLAUDE.md says "a tool with no schema accepts any object", but `validate-params.test.js` asserts `inputSchema.type === 'object'` for every registered tool, so such a tool would fail the suite. Both are defensible; they just do not agree about whether a schema is optional.

## Suite status

`mcp-min/__tests__` + `test/unit`: **1605 passing, 6 skipped, 1 failing** — `modules.test.js > publishVersion() … single-dir workflow`, reproduced identically on a clean `master` worktree and tracked as TASK-9. Up from ~1491 tests before the fix.

Scope was respected exactly: TASK-4 through TASK-12 are untouched. Confirmed by inspection — no error middleware in `lib/server.js`, all six `tools[name]` / `mcpHandlers[method]` dispatch lookups still unguarded, `bin/pos-cli-mcp-config.js` still does not validate, `mcp-min/auth.js` JSDoc still has the wrong order, and `gui/next/src/lib/api/logsv2.js` untouched. The `hasOwnProperty` fix in commit a16db70 hardens config-key lookup, which is a different site from TASK-5's dispatch lookups, so there is no overlap.
<!-- SECTION:FINAL_SUMMARY:END -->
