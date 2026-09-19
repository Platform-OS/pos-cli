---
id: TASK-23.1
title: >-
  MCP: make the tool description the single source, and stop shipping it
  duplicated in tools.config.json
status: Done
assignee: []
created_date: '2026-09-18 17:13'
updated_date: '2026-09-18 21:45'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/tools-config.js
  - mcp-min/tools.config.json
  - mcp-min/__tests__/tools-config-validation.test.js
parent_task_id: TASK-23
priority: high
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prerequisite for the rewrite: today, editing a tool's description in its module changes nothing a client sees.

`mcp-min/tools.config.json` ships with a `description` for all 36 tools, and `configuredTool()` (mcp-min/tools-config.js) prefers the config's over the module's. So the config is the effective source for every tool, and the module text is dead. Six pairs have already drifted apart, with the longer, better-informed module text being the one discarded.

The override itself is a wanted feature — the file is documented as "edit descriptions and enable/disable tools without touching JS code", and a test pins that a config description reaches the exposed tool (mcp-min/__tests__/tools-config-validation.test.js). What is wrong is that the shipped file exercises the override for every tool by default, which has two consequences: module descriptions cannot be maintained, and a user who edits the file for any reason (say, to disable one tool) silently pins all 36 descriptions at that version and stops receiving upstream wording changes forever.

The fix is to ship the config asserting only what actually differs from the code's defaults, so the override stays available but unused out of the box.

Scope note: the config's `enabled` flags stay exactly as they are — `check` is disabled by default and must remain so. Only the redundant `description` values leave the shipped file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Editing a tool module's `description` changes what `tools/list` returns on both transports, for every tool, with no second edit anywhere
- [x] #2 The shipped tools.config.json no longer restates any description that equals the module's, and the set of enabled/disabled tools it produces is unchanged (`check` still disabled by default)
- [x] #3 A user-supplied config that does set a description still overrides the module's, and that behaviour keeps its test
- [x] #4 A test fails if the shipped config ever reintroduces a description that duplicates the module's, so this cannot silently regress
- [x] #5 A user whose customised config predates this change still gets the tools they configured, and upgrading does not change which tools are enabled for them
- [x] #6 `pos-cli mcp-config` reports the same descriptions the server serves, before and after the change
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The bundled `mcp-min/tools.config.json` now ships `"tools": {}` — overriding nothing. The description
in each tool module is what clients are shown, and `loadToolsConfig` still prefers a config's
`description` when a user writes one (`tools-config-validation.test.js:110`).

AC #2 is satisfied differently than written: `check` is not "still disabled by default" — the tool was
deleted (shell injection through its `config` param reaching `exec`), and its name now lives in
`REMOVED_TOOLS` so an existing config entry warns and is ignored rather than failing the server.

Two tests hold the line: one fails if the shipped config ever reintroduces a description equal to the
module's (`:188`), and one loads a legacy config carrying all 36 descriptions plus a disabled tool and
asserts both still take effect (`:212`), since a user's copied file predates this change.

`pos-cli mcp-config` resolves through the same `selectTools` and prints the same tool objects the
server registers, so it cannot report a description the server would not serve.
<!-- SECTION:NOTES:END -->
