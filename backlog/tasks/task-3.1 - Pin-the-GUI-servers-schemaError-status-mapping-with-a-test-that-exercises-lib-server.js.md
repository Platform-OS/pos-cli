---
id: TASK-3.1
title: >-
  Pin the GUI server's schemaError status mapping with a test that exercises
  lib/server.js
status: To Do
assignee: []
created_date: '2026-09-02 14:16'
labels:
  - tests
  - validation
  - gui
dependencies: []
references:
  - lib/server.js
  - test/unit/server.validation.test.js
  - mcp-min/__tests__/transport-validation.test.js
  - mcp-min/validate-params.js
parent_task_id: TASK-3
priority: low
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Carried forward from TASK-3, acceptance criterion 13 ("the schemaError branch is covered by a test at each of the four sites"). Three of the four sites are genuinely covered; the GUI site is not.

The three MCP dispatch paths route through `rejectionFor` in `mcp-min/validate-params.js`, and `mcp-min/__tests__/transport-validation.test.js` registers a test-only tool with an uncompilable schema (`{ type: 'not-a-real-type' }`) to reach them for real. Mutation-verified: flattening the mapping in `rejectionFor` to a constant 400 / -32602 fails 4 tests.

The GUI server keeps its own copy of the mapping in the `rejectInvalid` closure inside `lib/server.js` (CLAUDE.md notes the two "apply the same 400/500 rule and have to be changed together"). The test that claims to cover it — `test/unit/server.validation.test.js`, describe block "uncompilable schema on a GUI route" — builds a throwaway express app and calls `validate()` plus its own inline status expression. It never touches `lib/server.js`. Mutation-verified: replacing

```js
const status = result.schemaError ? 500 : 400;   // lib/server.js
```

with `const status = 400;` leaves all 32 tests in that file passing.

So the duplicated rule is pinned on one side only, and the side that is not pinned is the one that duplicates it.

The straightforward approach is to make the real route see an uncompilable schema — `vi.mock('#lib/validation/schemas/gui.js')` in a dedicated test file, returning a schema Ajv cannot compile for one of the five routes, then assert the route answers 500 and does not forward to the mocked Gateway. A separate file is needed because the existing suite depends on the real schemas. Replacing the throwaway-app test with that closes the gap; the alternative — exporting `rejectInvalid` so it can be tested directly — would also work but widens the module's surface for a test.

Not urgent: no schema in the repo fails to compile today, so the 500 branch is unreachable in practice. It matters as regression protection for a rule that is written down in two places.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A test drives a real lib/server.js route whose schema will not compile, and asserts the response is 500
- [ ] #2 That test asserts the mocked Gateway was not called, so an uncompilable schema still rejects rather than forwards
- [ ] #3 Changing the status expression in lib/server.js rejectInvalid to a constant 400 fails at least one test
- [ ] #4 The throwaway-express-app test in test/unit/server.validation.test.js is replaced rather than left alongside, so there is one place asserting this rule per side
<!-- AC:END -->
