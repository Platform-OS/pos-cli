---
id: TASK-6
title: >-
  Extract a shared tools.config loader so pos-cli mcp config and the MCP server
  agree
status: To Do
assignee: []
created_date: '2026-09-02 10:23'
labels:
  - refactor
  - mcp
dependencies: []
references:
  - mcp-min/tools.js
  - bin/pos-cli-mcp-config.js
  - mcp-min/tools.config.schema.json
priority: medium
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing duplication on `master`, surfaced while reviewing the Ajv validation branch.

`mcp-min/tools.config.json` (overridable with `MCP_TOOLS_CONFIG`) is read in two independent places that each reimplement the same logic:

- `mcp-min/tools.js` — reads and parses it, then `applyConfig` skips tools with `enabled === false` and overrides descriptions
- `bin/pos-cli-mcp-config.js:20` — reads and parses it again, then re-derives the enabled/disabled split with its own `cfg.enabled === false` loop and its own `config.tools || {}` fallback

They have already diverged. The `add-ajv-input-validation` branch adds schema validation to `mcp-min/tools.js` only, so `pos-cli mcp config` will print a configuration that the MCP server then refuses to start with. Neither reader tells the user that a configured tool name does not match any registered tool.

Extract one module (e.g. `mcp-min/config-loader.js`) that reads, validates against `mcp-min/tools.config.schema.json`, reports unknown tool names, and returns the resolved config plus its source. Both callers use it. This also removes the second copy of the enabled/disabled rule, so `pos-cli mcp config` can never disagree with what the server actually exposes.

Depends on TASK-3 only in the sense that the validation and unknown-name checks it adds should live in the shared loader rather than be re-added here — coordinate ordering, or do this after TASK-3 lands and move its logic in.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One module owns reading, validating and resolving mcp-min/tools.config.json, and both mcp-min/tools.js and bin/pos-cli-mcp-config.js use it
- [ ] #2 pos-cli mcp config rejects a config that the MCP server would reject, with the same message
- [ ] #3 The enabled/disabled rule exists in exactly one place
- [ ] #4 pos-cli mcp config output still distinguishes the bundled default from an MCP_TOOLS_CONFIG override
- [ ] #5 Tests cover both callers against a valid config, an invalid config, and a missing file
<!-- AC:END -->
