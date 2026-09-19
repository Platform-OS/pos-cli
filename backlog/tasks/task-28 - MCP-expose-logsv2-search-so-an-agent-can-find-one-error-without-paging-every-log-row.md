---
id: TASK-28
title: >-
  MCP: expose logsv2 search, so an agent can find one error without paging every
  log row
status: To Do
assignee: []
created_date: '2026-09-18 22:45'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - lib/swagger-client.js
  - bin/pos-cli-logsv2-search.js
  - mcp-min/logs/fetch.js
  - docs/MCP_COVERAGE.md
priority: medium
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`logs-fetch` is the only way an agent can read logs, and its whole input is `lastId` and `limit`.
There is no text match, no time range and no severity filter, so "find the error that happened when
I loaded that page" means paging every row since the last id and reading them all — the most
expensive possible way to answer the most common debugging question.

`pos-cli logsv2 search` searches the log store with SQL through the OpenObserve proxy. TASK-24's
audit decided to expose it.

Scoping, per TASK-24's four questions:

- **Credentials**: yes. It resolves them the ordinary way and sends the instance token to the proxy
  at `LOGS_PROXY_URL` (default `https://openobserve-proxy.platformos.dev`) — a different host from
  the instance, which is worth a line in the tool description and possibly in the instructions.
- **Working tree**: no.
- **Destructive**: no. Reads only.
- **Long-running**: no. One request, one answer.

`org_id` comes from `instance.uuid` via `Gateway.getInstance()`, never from a parameter, so the
no-redirecting-input rule already holds. `LOGS_PROXY_URL` is an environment variable rather than a
tool parameter, which keeps it outside the model's reach; confirm that stays true.

Note that `SwaggerProxy.client()` catches its own errors, logs them and returns `undefined`, so a
failure currently surfaces as a `TypeError` at the call site. A tool cannot use that: it needs the
resolver to throw, so `runTool` can classify it (`auth` for the 401 it already special-cases,
`unavailable` for a proxy that is down).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A `logs-search` tool searches an instance's logs by text and by time range without the caller writing SQL, and returns rows in the same shape `logs-fetch` does
- [ ] #2 If raw SQL is accepted at all, the decision is deliberate and written down, including what a model can reach with it and what it cannot
- [ ] #3 `org_id` is derived from the resolved credentials, never from a parameter, and a test pins that
- [ ] #4 A proxy that is unreachable, and a token the proxy rejects, are reported as `unavailable` and `auth` rather than as an internal error
- [ ] #5 `SwaggerProxy.client` no longer swallows its error and returns undefined on the path the tool uses
- [ ] #6 The tool description says the search goes to the log proxy, not to the instance, since that is a different host from the one the credentials name
- [ ] #7 `logs-fetch` and the new tool do not overlap confusingly — each description says when it is the right one
- [ ] #8 The tools/list byte pins in tool-surface.test.js are updated deliberately, and the dev profile decision for this tool is explicit
<!-- AC:END -->
