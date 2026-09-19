---
id: TASK-18
title: >-
  MCP: five more tools accept an `endpoint` argument that sends the instance
  token to any host it names
status: Done
assignee: []
created_date: '2026-09-17 20:13'
updated_date: '2026-09-17 20:21'
labels:
  - security
  - mcp
dependencies: []
references:
  - mcp-min/liquid/exec.js
  - mcp-min/graphql/exec.js
  - mcp-min/migrations/list.js
  - mcp-min/migrations/generate.js
  - mcp-min/migrations/run.js
  - mcp-min/logs/stream.js
  - mcp-min/auth.js
priority: high
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-13 Part 2 removed the `endpoint` argument from `deploy-status`, `deploy-wait` and `logs-fetch`: it replaced the URL a request went to while the `.pos` token was still sent, so a caller naming any host was handed this machine's platformOS credentials. The same argument is still on five exposed tools, verified on this branch (2026-09-17):

- `liquid-exec` — "Override the base URL for the Liquid exec endpoint"
- `graphql-exec` — "Override the base URL for the GraphQL endpoint"
- `migrations-list`, `migrations-generate`, `migrations-run` — "Override API base URL"

Each does `const baseUrl = params?.endpoint ? params.endpoint : auth.url` and then constructs the Gateway with `{ url: baseUrl, token: auth.token, email: auth.email }`. The token always comes from the resolved credentials; only the destination changes.

Why it matters more on MCP than on the CLI: `bin/pos-cli-fetch-logs.js` has a `--endpoint` flag, but a person types that. Here the argument is chosen by a model from whatever it has just read — a page, a log line, a data file — and the tools carrying it are the two most freely called (`graphql-exec`, `liquid-exec`).

`mcp-min/logs/stream.js` has the same argument and the same handler line. Its registry entry is commented out, so it is not exposed, but it would be a live hole the day someone re-enables it.

Not in scope: `instance-create`'s `endpoint_id` (a platformOS region id, not a URL) and the `url` + `email` + `token` trio in `authProperties`, which is the explicit-credentials path — the caller supplies the credential with the host, so nothing of this machine's leaves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No tool in mcp-min/tools.js declares an `endpoint` parameter, and no tool module reads `params.endpoint`
- [x] #2 A call passing `endpoint` to any of the five tools is rejected by the closed schema, with a test per tool
- [x] #3 Each of the five builds its request URL from the resolved credentials, proven by a test that passes an endpoint and asserts the Gateway was constructed with auth.url
- [x] #4 A registry-wide test fails if a future tool declares a parameter that can move the request off the resolved instance
- [x] #5 CHANGELOG records the removal as a security fix and no longer says other tools still accept it; docs/MCP_TOOLS.md parameter lists drop the argument
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`endpoint` is gone from `graphql-exec`, `liquid-exec`, `migrations-list`, `migrations-generate` and `migrations-run` — schema and handler — and from `logs/stream.js`, which is not registered but would have been a live hole the day it was. With TASK-13 Part 2's three, no MCP tool can be pointed at a host of the caller's choosing. Each handler now takes its URL from `auth.url`, with the reason in a comment at the site.

**The guard, not just the fix**: `mcp-min/__tests__/request-target.test.js` (48 tests) runs over the whole registry, so a tool added next year inherits the rule:
- every registered tool is checked for a parameter whose normalised name is one of sixteen that would redirect a request (`endpoint`, `baseUrl`, `apiUrl`, `host`, `origin`, `target`, `proxy`, …), not just for `endpoint`;
- the sources are scanned for `params.endpoint`, because a schema can be reopened while the handler still honours the argument;
- each of the five is checked twice — the closed schema rejects the argument with `-32602`, and the handler still builds the Gateway with `auth.url` if one somehow reaches it;
- the explicit-credentials path (`url` + `email` + `token`) is pinned as still working, because that is the supported way to call another instance and removing `endpoint` must not have taken it.

**Verified by mutation**: 7 mutants, all killed — the argument restored to a schema (two tools), honoured again in a handler (two tools), a redirecting parameter introduced under another name (`apiUrl`, `host`), and the explicit-credentials path broken.

Scope checked and deliberately left alone: `instance-create`'s `endpoint_id` is a platformOS region id, not a URL, and `bin/pos-cli-fetch-logs.js --endpoint` stays — on the command line a person chooses the host; the danger here was a model choosing it.

Also: `docs/MCP_TOOLS.md` lost twelve `endpoint` parameter rows plus the prose forms, CLAUDE.md's invariant now covers all eight tools and names the test that enforces it, and the CHANGELOG security entry was rewritten from "three tools, the rest separately" to the whole set. `BARE_TOOLS_LIST_BYTES` re-pinned 26,233 → 25,764, since five fewer parameter definitions ship to every client on every request.

While writing the tests, `migrations-generate` wrote a `marketplace_builder/migrations/` directory into the repository root — the hazard CLAUDE.md's testing section describes. The test now passes `skipWrite: true`; the stray directory was removed and a rerun leaves the tree clean.
<!-- SECTION:FINAL_SUMMARY:END -->
