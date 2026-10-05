---
id: TASK-56
title: >-
  logsv2 is unreachable: the CLI commands and the GUI Network panel all fail
  against the log proxy
status: To Do
assignee: []
created_date: '2026-09-22 16:50'
labels:
  - logsv2
  - gui
  - cli
  - broken
dependencies: []
priority: high
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every pos-cli feature built on the OpenObserve log proxy fails. Measured 2026-09-22.

## What fails

```
$ pos-cli logsv2 search verification --size 3 --json
[17:52:58] "Request failed with status 404"
```

With `DEBUG=1` the sequence is: the instance lookup succeeds and returns the org uuid, then

```
POST https://openobserve-proxy.platformos.dev/api/<uuid>/_search   → 404
```

The GUI's Network panel fails too — confirmed by the maintainer.

## Why this is one fault and not several

`lib/server.js` calls `gateway.logsv2()`, `Gateway.logsv2` delegates to `this.client`, and
`bin/pos-cli-gui-serve.js` sets that from `SwaggerProxy.client`. So the CLI and the GUI are the same
route. `logsv2 search`, `logsv2 searchAround`, `logsv2 reports`, `logsv2 alerts *` and the GUI
Network panel share one client and one host, and all fail together.

## What was ruled out

- **A flag or hidden setting.** `LOGS_PROXY_URL` (`lib/swagger-client.js:92`) is the only
  configuration point. Nothing per-environment in `.pos`, nothing in any config file.
- **An unprovisioned instance.** The proxy host answers Go's stock `404 page not found` on every
  path tried — `/`, `/healthz`, `/api`, `/web` — for unauthenticated probes and for the
  authenticated request with a real org uuid alike. A bogus uuid gets the identical 404.
- **A hostname that moved and was not followed.** `git log -S openobserve-proxy` finds one commit
  (`b814308 Logv2 (#526)`) introducing the default; it has never been changed.
- **DNS or TLS being evidence of a deployment.** The certificate is a wildcard for the parent
  domain, so any subdomain resolves and terminates TLS whether or not anything is running behind it.
  The host sits behind Cloudflare.

## What could not be determined from here

Whether the service is retired, moved to another hostname, or only reachable from inside the
platform network. That is the question to answer first, and it is not answerable from a developer
machine.

## Why it matters beyond the commands themselves

- **TASK-28 and TASK-29 are blocked on it** — both expose this capability to the MCP server, and
  shipping either today would add tools that 404 on every call. Their `docs/MCP_COVERAGE.md` rows
  moved from `expose` to `later`.
- **TASK-7** (the GUI interpolates the user's filter string into this SQL) and **TASK-8** (the same
  path mixes milliseconds and microseconds) are defects in code that currently cannot reach a
  server. Still real; not urgent while this is dead.
- Users get `Request failed with status 404` with no indication that the feature is unavailable
  rather than misused.

## If the service is genuinely gone

Then the decision is what to do with the code: remove the `logsv2` command group and the GUI panel,
or keep them behind a clear "not available" message. Leaving a command that answers 404 is the worst
of the three, and it is what ships today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The status of the log proxy is established: retired, moved, or reachable only from inside the platform
- [ ] #2 If a live host exists, the LOGS_PROXY_URL default points at it and `pos-cli logsv2 search <env>` returns rows against a real instance
- [ ] #3 If the service is gone, a decision is recorded on whether the logsv2 command group and the GUI Network panel are removed or kept behind an explicit unavailable message
- [ ] #4 Either way, a user running a logsv2 command no longer sees a bare 404 with no explanation
- [ ] #5 TASK-28 and TASK-29 are unblocked or closed according to that outcome, and their MCP_COVERAGE rows are set to match
<!-- AC:END -->
