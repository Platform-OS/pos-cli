---
id: TASK-48
title: 'Nothing validates schema YAML: check-run lints Liquid and JSON only'
status: To Do
assignee: []
created_date: '2026-09-22 06:45'
labels:
  - check
  - agent-facing
dependencies: []
references:
  - mcp-min/check/run.js
  - lib/check.js
priority: medium
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by an agent-perspective evaluation of the MCP server (2026-09-21), and it is a pos-cli gap rather than an MCP one.

The evaluator deployed four Liquid files and one table definition, `app/schema/eval_note.yml`. `check-run` reported `filesChecked: 4` — the Liquid. The YAML was not linted, which the description does say (*"Liquid and JSON"*), so the tool is honest.

The gap is that **no pos-cli command validates a schema YAML file**, so a malformed table definition reaches the deploy converter unchecked. For an agent this is the difference between a linting error it can fix locally and a failed deploy it has to interpret from a release record.

Worth settling at the same time: a table that still holds records cannot be dropped, and the instance reports that as a deploy-time validation failure (`schema/eval_note.yml: cannot be deleted — 1 record(s) still exist`). That is not something a local linter can know, so the boundary between "checkable here" and "only the instance can say" should be written down wherever the answer lands.

Separate, smaller, same file: `mcp-min/check/run.js` reimplements rather than reusing `lib/check.js`, which three bins use. No divergence has been found, but it is the same structural risk that let the MCP test tools miss `lib/test-runner`'s pre-flight check — worth a look while someone is in there.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A malformed schema YAML file is reported before a deploy, or a decision is recorded that it cannot be
- [ ] #2 check-run states what it does and does not cover, so a clean run is not read as a clean project
- [ ] #3 The MCP check-run and lib/check.js either share an implementation or the reason they differ is recorded
- [ ] #4 A test covers a schema file that is invalid YAML and one that is valid YAML but not a valid table
<!-- AC:END -->
