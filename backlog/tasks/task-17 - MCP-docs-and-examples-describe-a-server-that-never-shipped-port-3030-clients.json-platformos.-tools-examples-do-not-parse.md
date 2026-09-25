---
id: TASK-17
title: >-
  MCP docs and examples describe a server that never shipped: port 3030,
  clients.json, platformos.* tools; examples do not parse
status: Done
assignee: []
created_date: '2026-09-17 09:00'
updated_date: '2026-09-17 18:26'
labels:
  - docs
  - mcp
dependencies: []
references:
  - docs/SSE_GUIDE.md
  - docs/API.md
  - docs/POS-CLI.md
  - examples/mcp-client.js
  - examples/python-client.py
  - mcp-min/tools.js
  - docs/MCP_TOOLS.md
priority: low
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every MCP document and example in the repo describes the server `pos-cli-mcp` actually runs, and every example runs.

## Verified (2026-09-17, while implementing TASK-16)
- **Fictional server design.** `docs/SSE_GUIDE.md`, `docs/API.md`, `docs/POS-CLI.md`, `examples/mcp-client.js` and `examples/python-client.py` all arrived in #689. They describe a design that `mcp-min/` never implemented:
  - base URL `http://localhost:3030` (the real server uses 5910)
  - `npm run mcp` (no such script)
  - `clients.json` client secrets and an `x-api-key` admin header (no auth exists)
  - Zod validation (Ajv is used)
  - `platformos.logs.stream`, `platformos.logs.live`, `platformos.env.list`, `platformos.graphql.execute` and `platformos.liquid.render` (none are registered; `mcp-min/tools.js` uses names like `logs-fetch`, `envs-list`, `graphql-exec`)
  - a `/health` response with `tools`/`toolCount` (the real one is `{"status":"ok"}`)
  - MCP-style `content[0].text` responses from `POST /call` (the real one is `{ result }`)
- **Examples do not parse.** Both files end in a stray `","path":"examples/...` fragment and contain literal `\\n` escapes. `node --check examples/mcp-client.js` fails with `SyntaxError: Unexpected identifier 'path'`. `docs/API.md` stores literal `\"` escapes in its markdown.
- **What TASK-16 already did.** It removed only the false security claims (Bearer tokens, API key, rate limiting, 401) from `docs/SSE_GUIDE.md` and `docs/API.md` and replaced them with the actual protection. It left the rest alone. `examples/` still sends `Authorization: Bearer` headers, which nothing checks.

## Decide
Either rewrite these against the real endpoints and tool names, or delete them and point to `docs/MCP_TOOLS.md` and `mcp-min/README.md`, which are accurate. `docs/MCP_TOOLS.md` already documents every real tool with `curl` examples, so deletion loses nothing that works today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No document or example references port 3030, clients.json, x-api-key, Zod, or a tool name that mcp-min/tools.js does not register
- [x] #2 Every remaining example file passes node --check / python -m py_compile and, run against a local pos-cli-mcp, gets a 2xx from each endpoint it calls
- [x] #3 No document or example sends or describes an Authorization header for the MCP HTTP transport
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Deleted rather than rewritten: `docs/API.md`, `docs/POS-CLI.md`, `docs/SSE_GUIDE.md`, `examples/mcp-client.js`, `examples/python-client.py`.

Rewriting them would have produced a second reference for endpoints that are already deprecated and go at the next major (`GET /`, `/tools`, `/call`, `/call-stream`), duplicating `docs/MCP_TOOLS.md`, which documents the real server — every tool, `/mcp`, the security model — with working `curl`. None of the deleted files shipped in the npm package (`package.json` `files` covers lib, bin, gui, scripts, mcp-min), and nothing but `docs/MCP_TOOLS.md`'s "See Also" linked to them.

**Kept the one thing they had that was real**: `docs/MCP_TOOLS.md` gained a Streaming subsection — SSE from `/mcp` when the client accepts `text/event-stream`, progress notifications and the five-second heartbeat, and one line for the deprecated `POST /call-stream`.

**Fixed while there.** The Summary section claimed 27 tools in a list that omitted `env-add`, `data-validate`, the async test tools, `check-run` and all four Partner Portal tools, and counted `logs-stream`, which is commented out in the registry. It is now a table generated from the registry order (36 registered, 35 exposed, `check` disabled, the nine `dev` tools and the six deprecated ones marked), pointing at `pos-cli mcp-config` as the answer to trust. "Tool Locations" no longer gives someone else's absolute path (`/home/godot/projects/pos-cli/`). CLAUDE.md said `tests-run/run-async`; the tools are `unit-tests-run` and `tests-run-async`.

**The fix that lasts**: `mcp-min/__tests__/docs-tool-names.test.js` (11 tests). It checks README, CLAUDE.md, docs/MCP_TOOLS.md and mcp-min/README.md both ways — every backticked tool-shaped name is registered, and every registered tool is documented — plus that no document mentions port 3030, `clients.json`, `x-api-key`, Zod or a dotted `platformos.*` tool name. Non-tools that look like tools (`deploy-strt`, `partner-portal-url`, …) sit in a small allowlist, each with its reason, and a test asserts nothing in that allowlist is actually a tool. Verified to bite: four deliberate regressions (an invented tool in README, an undocumented tool, port 3030 creeping back, a dotted name) each fail it.

CHANGELOG records the deletion under Removals and no longer credits `docs/SSE_GUIDE.md` / `docs/API.md` with describing the real security model.
<!-- SECTION:FINAL_SUMMARY:END -->
