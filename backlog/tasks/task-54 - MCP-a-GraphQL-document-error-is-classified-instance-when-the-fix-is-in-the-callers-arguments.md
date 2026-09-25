---
id: TASK-54
title: >-
  MCP: a GraphQL document error is classified instance, when the fix is in the
  caller's arguments
status: Done
assignee: []
created_date: '2026-09-22 15:47'
updated_date: '2026-09-23 17:43'
labels:
  - mcp
  - agent-facing
  - errors
dependencies: []
modified_files:
  - mcp-min/graphql/exec.js
  - mcp-min/__tests__/graphql.exec.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - docs/MCP_TOOLS.md
  - CHANGELOG.md
priority: low
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Round 2 of the agent evaluation, finding F11.

```
graphql-exec { query: "{ admin_pages { results { id }", env: "verification" }
→ kind: "instance", code: "GRAPHQL_EXEC_ERROR",
  "syntax error, unexpected end of file at [1, 30]"
```

The message is excellent and the position is exact. The `kind` is arguable and probably wrong.

Per the server instructions, `instance` means "the instance refused it, so read the message rather than retrying unchanged", while `input` means "fix the arguments". A syntax error in the document the caller supplied is unambiguously the second. The whole purpose of `kind` is to be the machine-readable next step, so a client routing on `kind` alone is misrouted — it will not treat this as something it can correct and resend.

The same applies to a field that does not exist on a type (`Field 'name' doesn't exist on type 'LiquidPartial'`), which the evaluation also hit on its first call.

**Why this is low and not obvious.** pos-cli cannot parse GraphQL locally, so the only signal is what the instance says, and the instance is genuinely the thing that refused it. Telling "your document is malformed" apart from "your document is fine and the data made this fail" means reading the upstream error shape — platformOS returns an `errors[]` array whose entries carry an `extensions` payload, and a syntax error should be distinguishable there from a resolver failure. Whoever takes this should measure the two shapes against a live instance first rather than pattern-matching the message text.

A mutation the instance refused on its own data rules must stay `instance`. Only errors in the *document* move.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A malformed GraphQL document answers kind: input, because the fix is in the arguments
- [x] #2 A field or type the schema does not have also answers kind: input
- [x] #3 A mutation the instance refused on its own data rules stays kind: instance
- [x] #4 The distinction is drawn from the upstream error shape, measured against a live instance, not from matching words in the message
- [x] #5 The exact message and position the instance gave are preserved either way — that part was already right
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed. The discriminator is **whether the response carries a `data` key**, not anything in the message and not `extensions`.

## The signal, and why it is this one

GraphQL spec §7: a response whose request failed *before* execution — parse error, missing information, validation error — **must not** contain `data`; one where execution began **must** contain it, `null` included. So `Object.hasOwn(resp, 'data')` answers "did this document ever run?" outright.

This task expected `extensions` to be the signal. **It cannot be**: a parse error carries no `extensions` at all, and neither does an invalid variable value. Reading `extensions.code` would have misclassified 3 of the 8 document failures measured — including the syntax error that is this task's own headline example.

## Measured, 19 cases, against fk-block on 2026-09-23

| Category | `data` | Cases |
| --- | --- | --- |
| Parse (unclosed brace, empty document, non-GraphQL text) | **absent** | 3/3 |
| Validation (unknown field, unknown top-level field, unknown argument, wrong argument type, unknown fragment, selection on a scalar, variable invalid, several operations unnamed, field conflict) | **absent** | 9/9 |
| Runtime (two mutations refused by data rules, one partial) | **present, `null`** | 3/3 |
| Success | present, object | 4/4 |

Zero misclassifications. Three categories I had not anticipated — several operations with none named, a field-alias conflict, and an invalid **variable value** — all land on `input` correctly. The variable case matters: it is a fault in the `variables` argument rather than in the query text, and it is still the caller's to fix.

## The four criteria the discriminator has to meet

1. **A guarantee, not an observation.** It is a spec MUST, in both directions, rather than graphql-ruby behaviour that happened to show up.
2. **The transport must not synthesise or strip `data`.** Verified in `lib/apiRequest.js`: on a 2xx it returns `JSON.parse(text)` verbatim. An absent key stays absent. An empty body returns `{}` and a non-JSON body returns a string, neither of which reaches this branch because `graphQLErrors` finds no errors array.
3. **Only 2xx GraphQL bodies may reach the branch.** Verified in code (`if (!response.ok) throw`) *and* empirically — a rejected token answers **HTTP 401** and is thrown to `classify`, never arriving here. Same for 5xx. So the realistic sources of a non-document error with no `data` are all excluded.
4. **It must fail safe.** If platformOS ever started sending `data: null` on validation errors, document errors would revert to `kind: instance` — today's behaviour, not something worse. The harmful direction, a runtime error arriving without `data`, is spec-forbidden and could not be produced.

**Residual risk, stated rather than guarded:** a field-level permission failure emitted at validation time instead of execution time would read as `input`. Execution-time is what the spec requires and what graphql-ruby does, and the probe for it returned no errors on this instance, so there was nothing to reproduce. Inventing a guard for it would have been guessing.

## What changed

`graphql-exec` only. `constants-list/set/unset` also throw on GraphQL errors and deliberately keep `instance`: they build their own document from tool parameters, so a document fault there is pos-cli's bug, not the caller's, and what they realistically hit is a data-rule refusal.

- No `data` → `ToolError.input('GRAPHQL_DOCUMENT_ERROR', …, { errors })`. A separate code, because one code for two different next-actions is what `ERROR_KINDS`' own docstring argues against.
- `data` present → `ToolError.instance('GRAPHQL_EXEC_ERROR', …, { errors, data })`, unchanged.
- `details` on a document error carries **no** `data`; `data: null` would claim execution produced null when nothing ran.
- The message, `locations` and `path` are untouched (AC #5).
- Description: "an instance failure" → "an input failure", the only word in it that became false. −3 bytes, ledgered in `tool-surface.test.js` (22,601 → 22,598).

## Testing

12 new tests in `mcp-min/__tests__/graphql.exec.test.js` (5 → 17), with payloads copied verbatim from the live measurements.

Bite-checked, all five caught:

| Breakage | Failed |
| --- | --- |
| one classification again (the filed defect) | 6 |
| presence tested by truthiness, so `data: null` misreads as a document error | 4 |
| branching on `extensions.code`, as this task proposed | 4 |
| matching `syntax error` in the message text | 4 |
| a document error claiming `data: null` | 1 |

The third and fourth are worth noting: the tests now pin *why* the two rejected alternatives do not work, so nobody re-proposes them. File restored and sha256-verified.

Verified end to end through `runTool` against the live instance after every edit: 9 cases, all correct. Note the `.pos` entry there has a `url` and `token` but no `email`, so verification used the named-environment path (`env: 'block'`) — which is how an agent calls it anyway.
<!-- SECTION:FINAL_SUMMARY:END -->
