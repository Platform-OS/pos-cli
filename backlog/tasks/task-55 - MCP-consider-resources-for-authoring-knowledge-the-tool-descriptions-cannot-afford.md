---
id: TASK-55
title: >-
  MCP: consider resources for authoring knowledge the tool descriptions cannot
  afford
status: Done
assignee: []
created_date: '2026-09-22 15:47'
updated_date: '2026-09-23 21:06'
labels:
  - mcp
  - agent-facing
  - surface
dependencies: []
modified_files:
  - mcp-min/tests/run.js
  - mcp-min/__tests__/tests.run.test.js
  - docs/MCP_COVERAGE.md
  - CHANGELOG.md
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
- [x] #1 A decision is recorded on whether pos-cli should carry authoring guidance at all, or keep teaching at the point of failure
- [ ] #2 If resources are adopted: the server registers them, and a client that never reads one pays only for resources/list
- [x] #3 Nothing duplicates what a tool description or the server instructions already say
- [x] #4 Any content that belongs to another repository (the tests module, platformOS docs) is pointed at rather than copied, so it cannot go stale here
- [x] #5 The cheaper alternative is tried first where it fits: an error that names the next step, the way TESTS_MODULE_MISSING and NO_TESTS do
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Round 3 (2026-09-23) hit this again, in the same place, and the prediction in this task held exactly.** The evaluator could not learn a test body from anything the server said. It wrote one only after reading `modules/tests/assertions/equal` back off the instance with `graphql-exec` — instance data, not pos-cli source — which is how round 2 did it too.

Two things worth carrying into the decision:

- **The hard rule held both times.** Neither evaluation needed pos-cli's source; both reached the project's own code through a tool. That is evidence the gap is real but not blocking, which argues against spending per-request bytes on it.
- **It is now two of two rounds.** The round 3 report names it as one of three places an agent new to platformOS would be stuck, alongside the page front-matter format (`slug`), which nothing in the tool surface mentions either.

The cheaper answer this task already floats — teach at the point of failure — got stronger evidence too: `NO_TESTS_MATCHED` and `TESTS_MODULE_MISSING` were both singled out as good, and the remedy query they carry was fixed in this release after it returned 20 of 38 tests. A worked example attached to those errors would cost nothing until someone needs it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
**Decision: no resources. Teach at the point of failure.** AC #2 does not apply — nothing was registered.

This task said to decide the first question before building anything. Measuring it first is what settled it: **two of the three gaps this was opened for are not gaps.**

## What was measured (fk-block, 2026-09-23)

A project holding a page with no front matter, a page with it, a test written the way an agent guesses, and a table schema with a plausible-but-wrong key.

| Claimed gap | Measured |
| --- | --- |
| A page needs front matter with `slug` | **Not a gap.** `nofm.liquid` with no front matter at all deployed, took the slug `nofm` from its filename, and served 200 at `/nofm`. |
| A table schema's YAML shape | **Mostly not a gap.** `deploy-dry-run` refused it with the platform's own message: *"Unknown properties: fields. Available properties are: metadata, name, properties."* The converter teaches the correct shape itself. |
| What goes in a test file | **A real gap.** `deploy-dry-run` refuses `assert_equal` with *"Body syntax is invalid (Liquid syntax error: Unknown tag 'assert_equal')"* — correct, and it says nothing about the right form. |

So the thing resources were being considered for is one item, not a corpus. That alone decides it against a new protocol capability: `resources/list` is served every session whether or not anything is read.

## Why pointing, not copying

The contract belongs to the `tests` module, and this task's own AC #4 says so. Measured on the verification instance: its assertions are **partials carrying a `{% doc %}` block that names every parameter they take** — ten of them, reachable with `admin_liquid_partials` filtered on `modules/tests/assertions/`.

That is the route both evaluations found for themselves, and it cannot go stale here: nothing in this repository restates the signature, so a change in that module changes the answer automatically.

## What shipped

`NO_TESTS` now says a test takes and returns a contract, and hands over the query that shows the assertions documenting themselves. **`NO_TESTS_MATCHED` deliberately does not carry it** — where tests already exist, real ones are the better example and `LIST_TESTS` names them. Adding it to both would put the less relevant answer on the more common error.

The message is paid only when the error fires; `tools/list` is unchanged.

## Verification

The pointer had to be actionable, so it was checked as a string rather than by eye: the query was extracted from `SHOW_ASSERTIONS` **verbatim** and run — 10 assertions returned, the first carrying `@param`.

Two new tests, bite-checked both ways:

| Breakage | Failed |
| --- | --- |
| the pointer removed from `NO_TESTS` | 1 |
| the pointer leaked onto `NO_TESTS_MATCHED` | 1 |

A test asserts the message does **not** name any assertion's own parameters, so a future copy-paste of the contract into this repository fails the suite.

`mcp-min` at 1616 passing, with the known `tools-config-validation` timeout. fk-block restored to empty.

## Not done, deliberately

The remaining half of the real gap is that `deploy-dry-run`'s refusal of `assert_equal` is the platform's message, forwarded verbatim. That is where round 2 actually got stuck, and it is not ours to rewrite — a tool that edits an instance's error text is a worse problem than the one it solves.
<!-- SECTION:FINAL_SUMMARY:END -->
