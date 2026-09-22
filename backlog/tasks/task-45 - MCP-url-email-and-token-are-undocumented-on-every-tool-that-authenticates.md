---
id: TASK-45
title: 'MCP: url, email and token are undocumented on every tool that authenticates'
status: To Do
assignee: []
created_date: '2026-09-22 06:45'
labels:
  - mcp
  - agent-facing
  - schemas
dependencies: []
references:
  - mcp-min/schemas/auth.js
  - mcp-min/auth.js
  - mcp-min/instructions.js
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
- [ ] #1 url, email and token each carry a description saying what they are and that the three go together
- [ ] #2 The precedence against env is stated where the argument is filled in, not only in the server instructions
- [ ] #3 The descriptions cost is measured against the dev profile's tools/list budget
- [ ] #4 A test fails if a shared auth property is published with no description
- [ ] #5 The exclusivity is either expressed in the schema or a note records why it was not
<!-- AC:END -->
