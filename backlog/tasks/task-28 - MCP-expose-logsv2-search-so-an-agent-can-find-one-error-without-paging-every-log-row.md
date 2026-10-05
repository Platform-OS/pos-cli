---
id: TASK-28
title: >-
  MCP: expose logsv2 search, so an agent can find one error without paging every
  log row
status: To Do
assignee: []
created_date: '2026-09-18 22:45'
updated_date: '2026-09-22 16:49'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Raised to high after round 2 of the agent evaluation (2026-09-22), which reproduced this task's premise independently.** The evaluator was given "find a specific error in the logs without reading everything" as a task and reported it as only survivable by luck: its instance held exactly five rows, so the error it wanted was in the first page. Its words: `logs-fetch` offers `lastId`, `limit` and credentials, and there is "no filter by error_type (the rows *have* one), no free-text match, no time window, no newest-first order", so "on any instance with a real log volume the only strategy is to page forward from the beginning until you reach now, paying for every row. That is the opposite of the tool's stated purpose."

It also confirmed the half that already works, which is what makes this purely additive: the cursor round-trips exactly, and an exhausted cursor returns the same `lastId` with `count: 0`. "The paging machinery is right; the query surface is missing."

Two findings from the same round narrow the scope usefully. The rows carry a usable `error_type` (`Liquid error`, `LowLevelError`, `<test_name> SUMMARY`), so filtering on it is worth having even before free text. And `logs-fetch` now documents that **only deployed code reaches this stream** — nothing rendered through `liquid-exec` appears, not even its own Liquid errors (measured 2026-09-22) — so an agent debugging a template has no log trail at all and leans harder on search when something does fail.

**BLOCKED as of 2026-09-22: the capability does not work at all, so this cannot be started.**

`pos-cli logsv2 search verification` fails with `Request failed with status 404`. With `DEBUG=1`: the instance lookup succeeds and returns its uuid, then `POST https://openobserve-proxy.platformos.dev/api/<uuid>/_search` 404s.

Established before concluding that:
- **No flag enables it.** `LOGS_PROXY_URL` (`lib/swagger-client.js:92`) is the only configuration point — nothing per-environment in `.pos`, nothing in any config file.
- **Not an unprovisioned instance.** The proxy host answers Go's stock `404 page not found` on every path, including `/healthz`, for unauthenticated probes and for our authenticated request with a real org uuid alike. A bogus uuid gets the identical 404.
- **Not a moved hostname we failed to follow.** `git log -S openobserve-proxy` shows one commit (`b814308 Logv2 (#526)`) introducing that default, never changed since. The TLS certificate is a wildcard for the parent domain, so the host resolving and terminating TLS says nothing about a service being deployed behind it.
- **The GUI is the same route, and also fails** — confirmed by the maintainer. `lib/server.js` → `Gateway.logsv2` → `this.client`, set from `SwaggerProxy.client` in `bin/pos-cli-gui-serve.js`. One client, so `search`, `searchAround`, `reports`, `alerts` and the GUI Network panel all fail together.

**Priority lowered from high back to medium.** It was raised earlier the same day because round 2 of the agent evaluation independently reproduced this task's premise — that part still stands, and the moment the service works this is worth doing. But a blocked task sitting at the top of the list is noise, and building it now would ship an MCP tool that 404s on every call, which is what `tests-run-async` was removed for.

**To unblock:** find out whether the proxy is retired, moved, or only reachable from inside the platform. If a live host exists, `LOGS_PROXY_URL` already accepts it and only the default needs changing — then AC #2 (whether to accept raw SQL) is the next decision, and it is still open.

One design note gathered while reviewing, so it is not lost: `SwaggerProxy.client` cannot be reused as-is by an MCP tool. Beyond swallowing its own error and returning `undefined` (AC #5), it resolves credentials with `fetchSettings`, the CLI resolver that reads `MPKIT_*` first. The MCP server must use `resolveAuth`, which reads a named environment from `.pos` and nowhere else — a difference CLAUDE.md records as deliberate.
<!-- SECTION:NOTES:END -->
