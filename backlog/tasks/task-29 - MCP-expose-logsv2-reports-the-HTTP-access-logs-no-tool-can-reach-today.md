---
id: TASK-29
title: 'MCP: expose logsv2 reports — the HTTP access logs no tool can reach today'
status: To Do
assignee: []
created_date: '2026-09-18 22:45'
labels:
  - mcp
  - agent-facing
dependencies:
  - TASK-28
references:
  - bin/pos-cli-logsv2-reports.js
  - lib/reports/r-4xx.json
  - lib/reports/r-slow.json
  - lib/reports/r-slow-by-count.json
  - docs/MCP_COVERAGE.md
priority: medium
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`pos-cli logsv2 reports` runs one of three canned queries — `r-4xx`, `r-slow`, `r-slow-by-count` —
against the `requests` stream: HTTP access logs with paths, status codes and response times. **No
MCP tool can reach that stream at all.** `logs-fetch` reads application logs, which is a different
thing: an agent can see that code logged an error, but not that an endpoint is returning 500s or
that a page takes four seconds.

This is a smaller and safer tool than TASK-28's search: the report names are a closed set and the
SQL ships in `lib/reports/*.json`, so nothing the model writes reaches the query. It is worth
having even if TASK-28 is deferred.

Scoping, per TASK-24's four questions: needs credentials; writes nothing; reads only; synchronous.

`reports` calls `searchSQLByQuery` directly rather than `buildQuery`, so it was not affected by the
implicit-global defect TASK-24 fixed — it is known to work.

The report JSON carries a `meta.title` and a `meta.columns` list that the CLI uses for its table.
A tool should return the rows as data and let the client decide how to present them, but the
column order is worth keeping: it is the order a person reading a slow-endpoint report wants.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A tool runs each of the three reports by name against the resolved instance, and an unknown report name is rejected as an input error naming the ones that exist
- [ ] #2 No SQL from the caller reaches the query — the report name selects a file, and a test pins that a name cannot escape `lib/reports/`
- [ ] #3 The result is structured rows, not the CLI's formatted table, and keeps the report's own column order
- [ ] #4 The description says what the `requests` stream is and how it differs from the application logs `logs-fetch` returns, so a model picks the right one
- [ ] #5 A proxy that is unreachable and a rejected token are classified the way TASK-28 classifies them
- [ ] #6 Adding a report JSON to lib/reports/ does not require editing the tool, or if it does, a test fails when the two disagree
<!-- AC:END -->
