---
id: TASK-54
title: >-
  MCP: a GraphQL document error is classified instance, when the fix is in the
  caller's arguments
status: To Do
assignee: []
created_date: '2026-09-22 15:47'
labels:
  - mcp
  - agent-facing
  - errors
dependencies: []
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
- [ ] #1 A malformed GraphQL document answers kind: input, because the fix is in the arguments
- [ ] #2 A field or type the schema does not have also answers kind: input
- [ ] #3 A mutation the instance refused on its own data rules stays kind: instance
- [ ] #4 The distinction is drawn from the upstream error shape, measured against a live instance, not from matching words in the message
- [ ] #5 The exact message and position the instance gave are preserved either way — that part was already right
<!-- AC:END -->
