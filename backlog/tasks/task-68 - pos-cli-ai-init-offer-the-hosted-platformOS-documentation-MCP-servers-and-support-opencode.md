---
id: TASK-68
title: >-
  pos-cli ai init: offer the hosted platformOS documentation MCP servers, and
  support opencode
status: Done
assignee: []
created_date: '2026-10-01 15:48'
updated_date: '2026-10-01 16:04'
labels:
  - mcp
  - cli
  - ai-init
dependencies: []
references:
  - 'https://pos-mcp-tools.ps-01-platformos.com/'
  - 'https://pos-mcp-tools.ps-01-platformos.com/liquid-mcp'
  - 'https://pos-mcp-tools.ps-01-platformos.com/graphql-mcp'
  - 'https://opencode.ai/docs/mcp-servers/'
  - 'https://code.claude.com/docs/en/mcp'
modified_files:
  - lib/ai.js
  - bin/pos-cli-ai-init.js
  - test/unit/ai.test.js
  - README.md
priority: medium
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`pos-cli ai init` registers the two local stdio MCP servers (`platformos-cli`, `platformos-supervisor`) into an AI tool's configuration. platformOS now also hosts two public, read-only reference servers over streamable HTTP, and nothing in pos-cli tells anyone they exist:

| Name | Endpoint | What it answers |
|---|---|---|
| `platformos-liquid` | `https://pos-mcp-tools.ps-01-platformos.com/liquid-mcp` | platformOS Liquid tags, filters, objects, language topics, from the official docs |
| `platformos-graphql` | `https://pos-mcp-tools.ps-01-platformos.com/graphql-mcp` | the platformOS GraphQL schema, 200+ operations, with worked examples |

Both were probed on 2026-10-01: MCP protocol 2025-06-18, `tools` and `resources` capabilities, no authentication, no code execution. Their own server instructions point execution back at `platformos-cli` (`liquid-exec`, `graphql-exec`, `check-run`), so the four servers are complementary rather than overlapping — these two stop an agent guessing a tag or field name, which is the single most common way generated platformOS code is wrong.

Two things are missing, and they ship together because they are the same code path:

1. **The documentation servers are never offered.** Add them as a second, optional step after the tool is chosen.
2. **opencode is not a supported tool.** It is in daily use here and configures MCP differently from the three tools already supported — `opencode.json`, servers under an `mcp` key, `type: "local"` with `command` as an array, `type: "remote"` for hosted ones.

The documentation servers are not project-specific, so the step asks where they should go: this project, or every project on this machine. The global file differs per tool, and for VS Code it also differs per platform and per VS Code flavour (Code, Insiders, VSCodium), which is why the decision below is to not guess it.

**Decisions already taken** (do not re-open without saying so):
- The step is **opt-out, not opt-in**. `--tool <t>` with no documentation flag writes them, into the project configuration. This changes what an existing scripted `pos-cli ai init --tool claude` writes, and that is accepted — it is why `--no-docs` exists and why the README has to say so.
- The scope question is **asked at the prompt**, with `--docs <scope>` carrying the answer for non-interactive runs.
- **VS Code global scope is refused, not guessed.** Print the snippet and tell the user to run `MCP: Open User Configuration`.

**Reference — the configuration shape each tool wants:**

| Tool | Project file | Global file | Key | Local entry | Remote entry |
|---|---|---|---|---|---|
| Claude Code | `.mcp.json` | `~/.claude.json` | `mcpServers` | `{command, args}` | `{type: "http", url}` |
| Cursor | `.cursor/mcp.json` | `~/.cursor/mcp.json` | `mcpServers` | `{command, args}` | `{url}` |
| VS Code | `.vscode/mcp.json` | (refused) | `servers` | `{type: "stdio", command, args}` | `{type: "http", url}` |
| opencode | `opencode.json` | `~/.config/opencode/opencode.json` | `mcp` | `{type: "local", command: [...], enabled: true}` | `{type: "remote", url, enabled: true}` |

`~/.claude.json` is not a file pos-cli owns — it also holds Claude Code's own project history and session state. It must be merged key-by-key and never rewritten from a template, and nothing outside `mcpServers` may be touched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `pos-cli ai init` run interactively asks a second question after the tool question: whether to add the platformOS documentation MCP servers, offering No, this project, or all projects
- [x] #2 Answering "this project" writes `platformos-liquid` and `platformos-graphql` into the same configuration file the local servers were written to, in the remote-server shape that tool expects
- [x] #3 Answering "all projects" writes them into that tool's user-global configuration file instead, leaving the project file holding only the local servers
- [x] #4 Answering No writes neither, and the local servers are still registered
- [x] #5 `--docs project`, `--docs global` and `--no-docs` each skip the second prompt and take that answer, so `--tool <t> --docs <scope>` and `--tool <t> --no-docs` are fully non-interactive
- [x] #6 `--tool <t>` with no documentation flag registers the documentation servers into the project configuration, and the README states this changed
- [x] #7 `opencode` is accepted by `--tool` and offered in the interactive list, and writes `opencode.json` with servers under the `mcp` key, local servers as `type: "local"` with `command` as an array
- [x] #8 `--tool vscode --docs global` does not write any file outside the project; it reports that VS Code's user configuration must be opened with the `MCP: Open User Configuration` command and prints the snippet to paste
- [x] #9 Writing to `~/.claude.json` preserves every key the file already had, including `projects` and any Claude Code state, and changes nothing outside `mcpServers`
- [x] #10 A documentation server entry a user has edited by hand is left alone and reported, matching how a customised local server entry is already handled
- [x] #11 Re-running any of these combinations is idempotent: the second run reports nothing to do and does not rewrite the file
- [x] #12 A global configuration file that does not exist yet is created, with its parent directory, at the correct path for the platform
- [x] #13 `--tool other` prints the documentation servers alongside the local ones in its manual snippet
- [x] #14 Unit tests cover each of the above against a temporary directory, with the home directory redirected so no test touches the real `~/.claude.json`; each new test is verified to fail when the behaviour it names is broken
- [x] #15 README documents the second step, the `--docs`/`--no-docs` flags, opencode support, and what the two hosted servers are for
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`pos-cli ai init` now has a second step, and opencode is a supported tool.

**What changed**

`lib/ai.js` gained `DOCS_SERVERS` (the two hosted reference servers) and an `opencode` entry in `TOOLS`. Each tool description gained two fields: `remote`, which says how that client spells a hosted server, and `global`, which says where it keeps the servers it uses in every project.

The merge that was inlined in `configureTool` is now `mergeServers`, taking the wanted servers, how to build an entry, the earlier forms to recognise and the old name to rename from. The local servers pass `PREVIOUS_SERVERS` and `RENAMED_FROM`; the documentation servers pass nothing, because they have never been written under another name. The loop body is otherwise unchanged — diffed line by line against the previous version, and the 28 pre-existing tests pass untouched apart from being pinned to `docs: 'none'` so they keep asserting exactly what they asserted before.

`updateConfig` takes a file path rather than deriving one, which is what lets the same code write a project file and a user-global one.

**The behaviour change to call out in review:** `pos-cli ai init --tool <t>` now registers four servers where it registered two. That was the decision taken when the task was filed — naming a tool means "take the defaults without asking", and the default answer is yes. `--no-docs` restores the old output, and the README says so.

**Writes are atomic.** `writeJson` writes beside the target and renames on, removing the temporary file if anything fails. This exists for `~/.claude.json`, which is Claude Code's own file — it holds the project history, session state and OAuth account alongside `mcpServers`, and a torn write would take those with it. Verified live against a realistic 7-key file: every key kept, key order kept, only `mcpServers` extended.

**VS Code global scope is refused rather than guessed.** Its user configuration path depends on the platform and on the installed build (Code, Insiders, VSCodium). `--tool vscode --docs global` writes the project file, then prints the snippet and names VS Code's own `MCP: Open User Configuration` command. Confirmed to create nothing outside the project.

**Testing.** 23 new tests, 51 in the file, all passing. Every one was proved to bite: 15 mutations applied to `lib/ai.js` one at a time, each caught by the test that names the behaviour — changed endpoint URL, docs written to the wrong scope, the global step skipped, each client's remote entry shape, the opencode command array flattened to a string, the default flipped to off, the prompt bypassed, `$schema` overwritten on an existing file, `XDG_CONFIG_HOME` ignored, the customisation guard removed, and the temporary-file cleanup removed.

Two first attempts were not real results and were redone: `--reporter=basic` does not exist in vitest 4, so the first sweep aborted before running anything and reported all 15 mutations uncaught; and the first customisation mutation added `{}` as a recognised earlier form, which no test input can distinguish, so it was inert rather than uncaught. The real mutation (overwriting customised entries) is caught by seven local tests and the documentation one.

`modules.test.js > does not error about directory when modules/ does not exist` fails on this branch at a 10 s timeout. It is pre-existing: it fails identically with these changes stashed, and nothing here touches that path.

**Verified live**, not only through fakes: all four tools, both scopes, with `HOME` redirected to a sandbox. `--tool claude` writes four servers and a re-run is a no-op; `--tool opencode --docs global` splits local servers into `opencode.json` and hosted ones into `~/.config/opencode/opencode.json`; `--tool claude --no-docs` writes exactly the two it wrote before. Both endpoints were probed directly first (MCP 2025-06-18, `tools` and `resources`, no authentication).
<!-- SECTION:FINAL_SUMMARY:END -->
