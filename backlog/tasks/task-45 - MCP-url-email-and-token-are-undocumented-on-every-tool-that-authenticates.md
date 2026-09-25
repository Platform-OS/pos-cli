---
id: TASK-45
title: 'MCP: url, email and token are undocumented on every tool that authenticates'
status: Done
assignee: []
created_date: '2026-09-22 06:45'
updated_date: '2026-09-22 12:09'
labels:
  - mcp
  - agent-facing
  - schemas
dependencies: []
references:
  - mcp-min/schemas/auth.js
  - mcp-min/auth.js
  - mcp-min/instructions.js
modified_files:
  - mcp-min/schemas/auth.js
  - mcp-min/__tests__/validate-params.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - CLAUDE.md
  - CHANGELOG.md
priority: medium
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by an agent-perspective evaluation of the MCP server (2026-09-21).

Every instance tool carries `email`, `token` and `url` from `authProperties`, with **no `description` at all**, sitting beside a documented `env`. From the server alone an agent cannot answer:

- are they an alternative to `env`, or an override?
- must all three be supplied together?
- what wins if both are passed?
- does `url` alone work, unauthenticated?

The instructions discuss only `env`. The evaluator never used them — the one thing it would not risk testing, because guessing wrong on `deploy-start` means deploying somewhere unexpected.

`resolveAuth` answers all of it (`mcp-min/auth.js`): the three are step 1 and are taken only together, an incomplete set is `INCOMPLETE_CREDENTIALS` rather than a fall back, and they beat `env`. None of that reaches the schema a client is shown.

**An undescribed credential parameter on a destructive tool is the highest-stakes ambiguity in the surface**, and it is on nineteen tools.

Worth considering with it: expressing the exclusivity in the schema (`env` xor `{url, email, token}`) so a client can see the grouping rather than infer it. The schema is published verbatim in `tools/list`, so whatever is written is what the model reads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 url, email and token each carry a description saying what they are and that the three go together
- [x] #2 The precedence against env is stated where the argument is filled in, not only in the server instructions
- [x] #3 The descriptions cost is measured against the dev profile's tools/list budget
- [x] #4 A test fails if a shared auth property is published with no description
- [x] #5 The exclusivity is either expressed in the schema or a note records why it was not
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Small in code — one object, three descriptions — and the most expensive change in this run, because
`authProperties` is spread into twenty-one tools and each publishes its own copy. Measured, not
estimated (AC #3): bare `tools/list` 19,305 → **22,725**, `--profile dev` 7,843 → **9,367**. Three
short sentences, 3,420 bytes. The wording is already at its floor; even empty descriptions would be
about a thousand of it, since `"description":` is 16 bytes per property per tool.

Bought anyway, and the rejected alternative is recorded beside the number: one sentence in the
server instructions costs about a fifteenth, and would have left the parameters that decide which
instance a call reaches undescribed at the one moment an agent is deciding what to put in them.
That is exactly where the evaluation stopped — it declined to experiment on `deploy-start`, which is
the correct instinct and also a capability going unused.

Split deliberately: the schema carries what cannot wait for the instructions (the three go together,
and they are used instead of `env`), and the instructions keep the full four-step precedence, which
is read once a session rather than per tool. `url` carries the precedence clause because it is the
one filled in first; `email` and `token` name their partners and stop.

**AC #5, and a reversal.** `dependentRequired: { url: ['email','token'], … }` expresses the grouping
exactly — I checked it compiles, publishes, accepts `{}`, `{env}` and the full triple, and rejects
`{url}` and `{url, token}`, at 94 bytes per tool. Rejected because it is a *sibling* of `properties`,
not a property, so it cannot travel inside `authProperties`; it would have to be spread into
twenty-one tool schemas by hand, which is precisely the drift that object exists to prevent, for
another 1,974 bytes bare. And it duplicates a check `resolveAuth` already makes with a better
message: `INCOMPLETE_CREDENTIALS` names what is missing. The schema states the rule; the resolver
enforces it. Reason recorded in `schemas/auth.js`, which the AC allows.

AC #4 is checked on the shared object rather than per tool — that is the only copy, and a
description dropped from it goes quiet on all twenty-one at once. Five deliberate reverts, all
caught, including two that kept a description but removed what it said.
<!-- SECTION:NOTES:END -->
