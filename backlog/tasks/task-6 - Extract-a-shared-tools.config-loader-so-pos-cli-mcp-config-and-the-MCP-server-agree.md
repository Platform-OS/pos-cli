---
id: TASK-6
title: >-
  Extract a shared tools.config loader so pos-cli mcp-config and the MCP server
  agree
status: Done
assignee: []
created_date: '2026-09-02 10:23'
updated_date: '2026-09-17 13:11'
labels:
  - refactor
  - mcp
dependencies: []
references:
  - mcp-min/tools.js
  - bin/pos-cli-mcp-config.js
  - mcp-min/tools.config.schema.json
priority: medium
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing duplication on `master`, surfaced while reviewing the Ajv validation branch.

`mcp-min/tools.config.json` (overridable with `MCP_TOOLS_CONFIG`) is read in two independent places that each reimplement the same logic:

- `mcp-min/tools.js` — reads and parses it, then `applyConfig` skips tools with `enabled === false` and overrides descriptions
- `bin/pos-cli-mcp-config.js:20` — reads and parses it again, then re-derives the enabled/disabled split with its own `cfg.enabled === false` loop and its own `config.tools || {}` fallback

They have already diverged. The `add-ajv-input-validation` branch adds schema validation to `mcp-min/tools.js` only, so `pos-cli mcp-config` will print a configuration that the MCP server then refuses to start with. Neither reader tells the user that a configured tool name does not match any registered tool.

Extract one module (e.g. `mcp-min/config-loader.js`) that reads, validates against `mcp-min/tools.config.schema.json`, reports unknown tool names, and returns the resolved config plus its source. Both callers use it. This also removes the second copy of the enabled/disabled rule, so `pos-cli mcp-config` can never disagree with what the server actually exposes.

Depends on TASK-3 only in the sense that the validation and unknown-name checks it adds should live in the shared loader rather than be re-added here — coordinate ordering, or do this after TASK-3 lands and move its logic in.

Command spelling: `pos-cli mcp-config` (the `pos-cli-mcp-config` bin, registered as a `pos-cli` subcommand by TASK-14). `pos-cli mcp config` is a different invocation: it passes `config` to the MCP server, which since TASK-14 refuses it and points to `pos-cli mcp-config`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One module owns reading, validating and resolving mcp-min/tools.config.json, and both mcp-min/tools.js and bin/pos-cli-mcp-config.js use it
- [x] #2 pos-cli mcp-config rejects a config that the MCP server would reject, with the same message
- [x] #3 The enabled/disabled rule exists in exactly one place
- [x] #4 pos-cli mcp-config output still distinguishes the bundled default from an MCP_TOOLS_CONFIG override
- [x] #5 Tests cover both callers against a valid config, an invalid config, and a missing file
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implemented with TASK-13 Part 1 (2026-09-17)
- **Loader.** `mcp-min/tools-config.js` is the only reader of the tools config: `toolsConfigLocation(env)`, `loadToolsConfig(registry, { env })` → `{ path, source: 'bundled' | 'MCP_TOOLS_CONFIG', state: 'loaded' | 'missing' | 'unreadable' | 'unparseable', config }`, `isDisabledByConfig` (the one enabled/disabled rule) and `configuredTool` (the description override). It keeps TASK-3's schema check and unknown-name check, with the same messages.
- **Both callers use it.** The server and `pos-cli mcp-config` go through `selectTools` (`mcp-min/tool-selection.js`). `tools.js` no longer reads config at import, so the loader takes `env` explicitly and is tested in-process.
- **`pos-cli mcp-config` changes.**
  - It lists registered tools as the server exposes them, not the entries in the file.
  - It rejects an invalid config with byte-identical stderr to the server.
  - It shows `default (bundled)` vs `MCP_TOOLS_CONFIG` plus the file state.
  - It no longer exits 1 on a missing or unparseable file; it reports that defaults apply, as the server does.
  - `--json` is the resolved report (see TASK-13).
- **Warning.** A missing or unparseable file named by `MCP_TOOLS_CONFIG` now logs a warning in the server.
- **Tests** (`mcp-min/__tests__/tools-config-validation.test.js`):
  - schema and unknown-name rejections, including prototype keys (`__proto__` as an own key)
  - the missing, unparseable and unreadable states
  - location precedence
  - the disabled rule
  - both bins spawned against an invalid config (same message, no stack trace), a valid override (text and JSON), a missing file (mcp-config shows the state; the server starts with every tool and warns), and the bundled default
- Mutation-tested with TASK-13: K1–K8 on the loader were all killed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## One loader for the MCP tools config

`mcp-min/tools-config.js` is now the only reader of `tools.config.json` / `MCP_TOOLS_CONFIG`. It reads the file, validates it against the schema, rejects unknown tool names, and owns the enabled/disabled rule and the description override. The MCP server and `pos-cli mcp-config` both resolve through it (via `selectTools`, TASK-13), so `mcp-config` prints exactly what the server exposes and refuses exactly what the server refuses, with the same message.

**Behaviour changes**
- `pos-cli mcp-config` lists registered tools rather than config-file entries, and shows the config source and its state.
- A missing or unparseable file no longer makes `pos-cli mcp-config` exit 1. It shows that defaults apply, which is what the server does.
- The server logs a warning when a file named by `MCP_TOOLS_CONFIG` could not be used.

**Tests**
- Loader: in-process unit tests.
- Both bins: spawned against an invalid, a valid, a missing and the bundled config.
- Mutation-tested: all 8 loader mutants killed.
<!-- SECTION:FINAL_SUMMARY:END -->
