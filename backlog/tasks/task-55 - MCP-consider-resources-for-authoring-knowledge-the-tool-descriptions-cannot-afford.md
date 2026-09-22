---
id: TASK-55
title: >-
  MCP: consider resources for authoring knowledge the tool descriptions cannot
  afford
status: To Do
assignee: []
created_date: '2026-09-22 15:47'
labels:
  - mcp
  - agent-facing
  - surface
dependencies: []
priority: low
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Round 2 of the agent evaluation, finding F8 — the one place the evaluator said it came close to needing pos-cli's source.

It could not write a test from anything the server told it. `unit-tests-run` says where test files live and nothing about what goes in one. Its first attempt was the obvious guess:

```liquid
{% liquid
  assign sum = 2 | plus: 2
  assert_equal sum, 4
%}
```

`deploy-dry-run` correctly refused it (`Unknown tag 'assert_equal'`), and it recovered only by reading `modules/tests/public/lib/assertions/equal.liquid` — project code installed by a remedy, not pos-cli source, so the hard rule held, but only just. The real contract is that a test is a partial receiving and returning a `contract` object and calling `function contract = 'modules/tests/assertions/equal', …`, and nothing in `tools/list` hints at it.

**Partly addressed already.** The project layout went into `mcp-min/instructions.js` in 6.6.0, which is sent once a session rather than per request — that covered "where does a file go". What is still unanswered is "what goes *in* it", for tests, for a table schema (the evaluator also had nowhere to learn that tables come from YAML under `app/schema`), and for the assertion vocabulary.

**Why resources.** `mcp-min/protocol/server-factory.js` registers **no resources at all** today, so this is new protocol surface rather than an addition to an existing one. Resources are pull-based: a client fetches one when it wants it, so the content costs nothing until read — which is the only way a page of authoring guidance can be affordable at all. In a tool description it would be paid by every agent on every request.

**Arguments against, which need answering first.**
- Is this pos-cli's knowledge to hold? Tests belong to the `tests` module, which ships its own README; table schemas are platformOS's. A corpus here goes stale in someone else's repository.
- The house pattern is to teach at the point of failure, and it works: `TESTS_MODULE_MISSING` was singled out by the evaluation as better than most tools' success paths, and `NO_DIRECTORIES` names the three deployable roots. A cheaper answer may be to extend that — for instance, `NO_TESTS` already carries the query that lists test files.
- `resources/list` is served per session, so the *names* are not free even if the bodies are.

Decide the first question before building anything.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded on whether pos-cli should carry authoring guidance at all, or keep teaching at the point of failure
- [ ] #2 If resources are adopted: the server registers them, and a client that never reads one pays only for resources/list
- [ ] #3 Nothing duplicates what a tool description or the server instructions already say
- [ ] #4 Any content that belongs to another repository (the tests module, platformOS docs) is pointed at rather than copied, so it cannot go stale here
- [ ] #5 The cheaper alternative is tried first where it fits: an error that names the next step, the way TESTS_MODULE_MISSING and NO_TESTS do
<!-- AC:END -->
