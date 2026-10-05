---
id: TASK-44
title: >-
  MCP: nothing can read an instance back, so a deploy cannot be verified or
  recovered from
status: Done
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 11:54'
labels:
  - mcp
  - agent-facing
  - coverage
dependencies: []
references:
  - docs/MCP_COVERAGE.md
  - mcp-min/tools.js
  - lib/proxy.js
modified_files:
  - mcp-min/page/fetch.js
  - mcp-min/tools.js
  - mcp-min/profiles.js
  - mcp-min/graphql/exec.js
  - mcp-min/__tests__/page.fetch.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - mcp-min/__tests__/tool-selection.test.js
  - mcp-min/__tests__/validate-params.test.js
  - mcp-min/__tests__/docs-tool-names.test.js
  - docs/MCP_COVERAGE.md
  - docs/MCP_TOOLS.md
  - CLAUDE.md
  - CHANGELOG.md
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
- [x] #1 docs/MCP_COVERAGE.md records a decision — expose, later or never, with the reason — for reading files back from an instance and for fetching a page by path
- [x] #2 If exposed: an agent can confirm a deployed page is live without leaving the server
- [x] #3 If exposed: an agent can enumerate what is on an instance before a non-partial deploy deletes it
- [x] #4 Whatever is decided, job-status no longer advertises downloadable: false with nothing able to act on it
- [x] #5 The token cost of any new tool is measured against the dev profile's budget before it is added
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**The premise was wrong, and checking it first is what shaped the answer.** The instance serves a
full admin read API over GraphQL, and `graphql-exec` — already exposed, already in `dev` — has
always reached all of it. Verified live on 2026-09-22 by introspection and then by querying:
`admin_pages` returns `slug`, `physical_file_path` and `content`; `admin_liquid_partials` returns
`path` and `body`; `admin_assets` returns `name`, `url`, `content_type`, `file_size`; beside
`admin_graphql`, `admin_model_schemas`, `admin_forms`, `admin_authorization_policies`,
`admin_liquid_layouts`, `admin_tables`, `admin_current_instance`, `admin_versions`.

So AC #3 was already satisfiable and nobody knew. The evaluation's data loss was a discoverability
failure, not a capability gap — which turned a read-back tool from the obvious answer into the wrong
one: 450–900 bytes on every request to duplicate what one clause of `graphql-exec`'s description
(128 bytes, once) makes findable. Measured per-tool cost in the dev profile before deciding, which
is AC #5.

**`page-fetch` is the part GraphQL genuinely cannot do.** `admin_pages { content }` proves the
source arrived; routing, the layout, the authorization policies and every partial the page renders
sit between that and a URL a visitor opens. It is in `dev` because that profile is named for
edit → check → deploy → **verify**, and verify was the step the evaluation had to take outside the
server.

It is the first tool here that makes an arbitrary HTTP request, so most of its design is refusals:

- `path` is checked **twice**. The schema requires one leading slash and no second (`^/(?!/).*$`),
  and the URL built from it must still have the credentials' origin. The second check is the one
  that holds the rule — `//elsewhere.example.com` reads as a path and is another host to `new URL`
  — and it is the comparison `authForJob` already makes. Refused before any request.
- **No credentials are sent.** A page that renders only for a holder of the instance token is not a
  page that is live, and it means a redirect — reported, never followed — cannot carry one away.
- Not `readOnlyHint`: a GET runs the page's Liquid and this tool cannot know what that does.
- A 404 is `ok: true` with `status: 404`. The agent asked whether the page is live; it is not.

Two bugs my own tests caught before this shipped. The body cut used
`Buffer.subarray().toString('utf8')`, which emits U+FFFD at the cut — three bytes where one was
dropped, so a "bounded" body came back corrupt and 16,386 bytes against a 16,384 ceiling. Replaced
with a streaming `TextDecoder`, which holds the incomplete sequence back. And the fake instance used
`new Response(string)`, which undici gives `text/plain`, so the case about a response with no
content-type could not have been written with it — a Buffer body fixed that.

Budget: one raise, 7,000 → 8,000, covering both halves because the user asked for them together.
The comment above it now distinguishes the two kinds of growth, which the previous entry ran
together: **prose** comes out of existing text, because the profile has no claim on more bytes for
saying the same things at greater length; **a tool** is a surface decision argued on what an agent
cannot otherwise do. The `admin_*` clause is prose by that rule and bought anyway, with the reason
recorded: a capability nobody can find is one the profile is already paying for and not getting.

AC #4: `downloadable` is the platform's own field in a release record `job-status` forwards
verbatim. Cherry-picking a record we pass through is worse than carrying a field that is currently
always false, so the coverage doc records that `pull` — already `later` — is what would act on it,
and where the decision changes if it ever comes back true.

The coverage decisions are in prose rather than the decision table: that table is derived from
`bin/` by `cli-coverage.test.js`, and a row for something no CLI command does fails its own test.

Verified live: `/eval-page` came back 200 with the deployed partial expanded (`MARKER-V1`), which is
the end-to-end proof GraphQL cannot give; `/no-such-page` 404 as `ok: true`; `//evil.example.com/x`
refused. 14 deliberate reverts, sha256-verified restore, all caught — one after redesigning the
cancellation test, which asserted only the kind and so passed whether or not a request had already
been made. mcp-min 1529 passing across 62 files; test/unit 1336 with the pre-existing TASK-9 failure
only.
<!-- SECTION:NOTES:END -->
