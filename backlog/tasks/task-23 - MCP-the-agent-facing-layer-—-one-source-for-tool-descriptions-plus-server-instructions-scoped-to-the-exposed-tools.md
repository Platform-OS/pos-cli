---
id: TASK-23
title: >-
  MCP: the agent-facing layer — one source for tool descriptions, plus server
  instructions scoped to the exposed tools
status: Done
assignee: []
created_date: '2026-09-18 17:10'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - /home/ecgtheow/Work/pos-agent/platformos-agent-kit/dist/knowledge/tools.md
  - docs/MCP_TOOLS.md
  - mcp-min/tools.config.json
  - mcp-min/tools-config.js
  - mcp-min/protocol/server-factory.js
priority: high
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The MCP server was built out over this branch — transport, protocol, auth, redaction, job handles, shutdown — without a pass over the layer the model actually reads. Two defects and one absence:

1. **Descriptions have two sources and the wrong one wins.** Every tool module declares `description:`, and `mcp-min/tools.config.json` declares one for all 36 tools as well. `configuredTool()` (mcp-min/tools-config.js) prefers the config, so every module description is dead text. Six have already drifted, and in each case the discarded one is the better one — `liquid-exec` 299 chars in JS vs 97 shipped, `graphql-exec` 271 vs 71 (the shipped one loses "use variables rather than string interpolation"), `sync-file` 290 vs 58.

2. **The shipped config freezes descriptions for anyone who edits it.** `tools.config.json` is inside the npm package (`files: ["…", "mcp-min"]`) and its own `_comment` invites users to edit it. A user who edits it to disable one tool pins all 36 descriptions at that version; upgrades never reach them.

3. **There are no house rules.** The MCP spec has a server-level `instructions` field, returned at `initialize` and `server/discover`, and the SDK supports it (node_modules/@modelcontextprotocol/server/dist/createMcpHandler-CLhGwQTn.d.mts:2777). pos-cli passes none. Nothing tells a model that `env` should be named explicitly, that `job-status` supersedes six deprecated tools, that a successful `liquid-exec` render is not evidence the code deploys, or that `data-clean` is destructive. That guidance exists only in docs/MCP_TOOLS.md, which no model reads.

The requirement that shapes the design: **what reaches the agent must match what the agent can call.** `tools/list` already honours that — it lists only exposed tools. Instructions must honour it too: a server started with `--profile dev` (9 tools) must not carry a sentence about `data-clean`, and `--include-tools`/`--exclude-tools` must move the instructions with them. The exposed set already lands in exactly one place, `selectTools().tools`, so instructions are derived from that Map rather than from a second list that can drift.

Split into three subtasks because they are separable and a reviewer should not take a config-format change, 36 rewritten descriptions and a new instructions subsystem in one sitting.

Known gap, deliberately out of scope: the agent kit's house rules tell an agent to confirm deployability with `deploy --dry-run`, and the MCP server exposes no dry-run — `deploy-start` takes only `partial`. The CLI has `dryRunStrategy`. Worth its own task; do not paper over it in wording here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A tool's description is written in exactly one place, and editing that place changes what an MCP client is shown
- [x] #2 A user who customises the tools config still receives upstream description changes on upgrade
- [x] #3 The server sends MCP `instructions`, and they name only tools the running server exposes, under every profile / --include-tools / --exclude-tools / config-disabled combination
- [x] #4 `pos-cli mcp-config` shows the instructions a given selection would produce, so the result can be checked without starting an MCP client
- [x] #5 The tools/list byte counts pinned in `mcp-min/__tests__/tool-surface.test.js` are re-pinned deliberately, with the instructions payload accounted for in the dev budget
- [x] #6 docs/MCP_TOOLS.md and mcp-min/README.md describe where descriptions live and what instructions say; docs/MCP_TOOLS.md's stale "Total Tools: 26 active tools" is corrected (35 exposed of 36 registered)
- [x] #7 CHANGELOG Unreleased records the behaviour change for anyone who has edited tools.config.json
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delivered as 23.1 (single source), 23.2 (rewritten descriptions), 23.3 (server instructions).

`mcp-min/instructions.js` composes the MCP `instructions` string from the exposed `Map`, so a section
disappears with its tool and every profile / --include-tools / --exclude-tools / config-disabled
combination carries it with no second list to maintain. It holds only what no single tool owns —
how credentials resolve, what every result looks like, what a relative path is relative to — because
`tools/list` is sent with every request and instructions once per session.

Byte counts re-pinned deliberately: `BARE_TOOLS_LIST_BYTES` 25764 → 20109 (parameter descriptions cost
2x tool descriptions, and 49% of that prose was duplicate copies, now shared via
`schemas/record-checks.js` and `schemas/auth.js`); `DEV_TOOLS_LIST_BYTE_BUDGET` 7500 → 6000. The
instructions payload is budgeted separately in `instructions.test.js`, since a client is charged for
each once.
<!-- SECTION:NOTES:END -->
