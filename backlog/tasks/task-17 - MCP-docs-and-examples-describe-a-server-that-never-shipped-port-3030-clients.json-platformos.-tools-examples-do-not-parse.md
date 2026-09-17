---
id: TASK-17
title: >-
  MCP docs and examples describe a server that never shipped: port 3030,
  clients.json, platformos.* tools; examples do not parse
status: To Do
assignee: []
created_date: '2026-09-17 09:00'
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
- [ ] #1 No document or example references port 3030, clients.json, x-api-key, Zod, or a tool name that mcp-min/tools.js does not register
- [ ] #2 Every remaining example file passes node --check / python -m py_compile and, run against a local pos-cli-mcp, gets a 2xx from each endpoint it calls
- [ ] #3 No document or example sends or describes an Authorization header for the MCP HTTP transport
<!-- AC:END -->
