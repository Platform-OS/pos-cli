---
id: TASK-44
title: >-
  MCP: nothing can read an instance back, so a deploy cannot be verified or
  recovered from
status: To Do
assignee: []
created_date: '2026-09-22 06:44'
labels:
  - mcp
  - agent-facing
  - coverage
dependencies: []
references:
  - docs/MCP_COVERAGE.md
  - mcp-min/tools.js
  - lib/proxy.js
priority: medium
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by an agent-perspective evaluation of the MCP server (2026-09-21). Two findings with one cause.

**There is no tool that reads the instance.** Consequences the evaluator hit:

- It deleted a page it had never seen and could not recover it, because nothing lists or downloads what is on the instance. It also could not enumerate what else was there to check whether it had damaged anything it had not noticed.
- It could not answer "what is this project?" for an instance it did not build.
- `job-status` reports `"downloadable": false` on every release, which suggests the platform has a download capability this profile does not expose.

**There is no way to fetch a deployed page.** Confirming a partial is elegant and entirely in-server — `liquid-exec { template: "{% render 'eval/marker' %}" }` makes the instance render deployed source, which proves liveness. That does not extend to pages: `liquid-exec` renders source the caller supplies, not a page by slug, and there is no HTTP-fetch tool. The evaluator had to fetch the URL from outside the server. So **the most basic verification an agent needs after a deploy cannot be done with this server alone.**

A page fetch would also have diagnosed the missing test runner immediately, instead of costing four calls.

Related and already filed: TASK-26 (module lifecycle — `gateway.listModules()` exists and only the new tests-module check uses it).

This is a coverage decision as much as an implementation one, so it belongs in `docs/MCP_COVERAGE.md` first: every tool costs tokens on every request, and "expose everything" has never been the goal. But a deploy tool that deletes by default, with no way to see the target first, is the structural gap behind the data loss in the same evaluation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/MCP_COVERAGE.md records a decision — expose, later or never, with the reason — for reading files back from an instance and for fetching a page by path
- [ ] #2 If exposed: an agent can confirm a deployed page is live without leaving the server
- [ ] #3 If exposed: an agent can enumerate what is on an instance before a non-partial deploy deletes it
- [ ] #4 Whatever is decided, job-status no longer advertises downloadable: false with nothing able to act on it
- [ ] #5 The token cost of any new tool is measured against the dev profile's budget before it is added
<!-- AC:END -->
