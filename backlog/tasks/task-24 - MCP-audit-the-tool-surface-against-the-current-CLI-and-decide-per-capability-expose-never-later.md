---
id: TASK-24
title: >-
  MCP: audit the tool surface against the current CLI and decide, per
  capability, expose / never / later
status: Done
assignee: []
created_date: '2026-09-18 17:31'
updated_date: '2026-09-18 22:50'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - bin/pos-cli.js
  - mcp-min/tools.js
  - mcp-min/logs/stream.js
  - docs/MCP_TOOLS.md
priority: high
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 36 MCP tools were written against the CLI as it stood when each tool landed. Nobody has compared the two surfaces since, so the MCP server is a snapshot of an older pos-cli and there is no record of which absences are deliberate.

MEASURED on this branch — CLI capability vs MCP tool:

| CLI area | subcommands | MCP tools |
|---|---|---|
| modules (install, update, push, pull, list, show, version, build, init, migrate, overwrites, remove, uninstall) | 13 | 0 |
| logsv2 (search, searchAround, reports, alerts add/list/trigger) | 6 | 0 |
| dns (compare, export, import, migrate, status) | 5 | 0 |
| data (import, export, clean, update) | 4 | 3 — data-update missing |
| env (add, list, refresh-token) | 3 | 2 — env-refresh-token missing |
| check (init, run, update-docs) | 4 | 2 — check-init missing |
| deploy | 1 + flags | 1 — --dry-run not exposed |
| pull, init, clone, audit, archive | 5 | 0 |

About 35 CLI capabilities have no MCP tool. Two stand out because they are not merely missing but actively misleading: `logsv2` is the current logs stack (OpenObserve) while the MCP server exposes only the older `logs-fetch`, so an agent asked to search logs uses the superseded path; and the whole module dependency lifecycle is invisible, so an agent cannot discover what is installed, let alone install anything.

Separately: `mcp-min/logs/stream.js` is a complete tool module that is not in the registry. It is unreachable — never listed, never callable — and either belongs in the registry or belongs deleted.

THE POINT OF THIS TASK IS THE DECISION, NOT THE CODE. Exposing everything is wrong: `gui serve`, `lsp` and `init` are interactive or local and make no sense over MCP, and every tool added costs tokens for every agent on every request — the same budget TASK-23.2 exists to reduce. What is missing today is not the tools; it is any record of which absences were chosen.

The output is a decision per uncovered capability — expose, never expose, or expose later — each with its reason, written somewhere a future reader finds it, plus a task for each "expose" that is not already tracked. `deploy --dry-run` and the modules lifecycle are already decided and tracked separately; this audit covers everything else and must not re-open them.

The audit also has to answer, for each candidate: does it need credentials (so it inherits the env rule), does it write to the developer's working tree, is it destructive, and is it long-running enough to need the job_id/job-status pattern rather than a synchronous answer. A tool that writes files or deletes data is not a free addition.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every CLI capability without an MCP tool has a recorded decision — expose, never, or later — each with a stated reason
- [x] #2 The decisions are written where a future reader will find them, not left in a task comment or a chat log
- [x] #3 "Never" decisions say what makes the capability unsuitable for an agent (interactive, local-only, or meaningless without a terminal)
- [x] #4 Each capability marked "expose" that is not already tracked has a task, scoped with whether it needs credentials, writes to the working tree, is destructive, or needs the job_id pattern
- [x] #5 logsv2 has an explicit decision, given that it supersedes the logs stack the MCP server currently exposes
- [x] #6 mcp-min/logs/stream.js is either registered or deleted, and is no longer an unreachable module in the tree
- [x] #7 The audit states how it stays current — what makes the next CLI command that ships without an MCP tool visible rather than silent
- [x] #8 The audit does not re-open the deploy dry-run or modules decisions, which are tracked separately
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The decisions are in `docs/MCP_COVERAGE.md`, one row per pos-cli capability, linked from
`docs/MCP_TOOLS.md` and CLAUDE.md. 62 leaf capabilities; 22 have a tool; 14 are TASK-26's modules
lifecycle; 2 are newly tracked (TASK-28, TASK-29); 13 are never; 11 are later.

AC #7 is answered by `mcp-min/__tests__/cli-coverage.test.js`, not by a promise. It walks `bin/` the
way commander does — recursing into group files, stripping comments so the commented-out
`uploads pull` is not counted — and fails when a capability has no row, when a row names a
capability that no longer exists, when an `exposed` row names a tool the registry lacks, when an
`expose` row names a task nobody filed, or when a `never` row is secretly waiting on work. Four
mutants, all killed: a new CLI command, a renamed tool, a task that does not exist, a deleted row.

Two findings changed decisions that had looked obvious:

- **`audit` was demoted from expose to later.** Listing platformos-check's actual rules showed 54,
  including `DeprecatedTag` and `DeprecatedFilter` — two of audit's seven. A second linter that can
  disagree with the first is worse than neither.
- **`data update` is blocked, not declined.** The CLI ends with "Update scheduled. Check pos-cli
  logs", and there is no status endpoint, so `job-status` would have nothing to poll.

AC #5: the task's premise that logsv2 supersedes the logs stack was overstated, and the audit says
so. The README still lists logsv2 under a roadmap with alerts, errors and a GUI unbuilt, nothing
deprecates `pos-cli logs`, and `logsv2 search` did not run at all — see below. It is an additional
capability worth exposing, not a replacement the server was wrongly ignoring.

AC #6: `mcp-min/logs/stream.js` is deleted, with its test. Registering it was never an option — it
implements `streamHandler` (the deprecated pre-SDK interface the SDK path cannot call), returns a
promise that never resolves, and polls with no `ctx.signal` check. No registered tool has a
`streamHandler`, so `/call-stream` can only ever answer `tool has no streamHandler`; it stays
exercised by the synthetic tool in `http-shutdown.test.js`.

**The audit found a live bug outside its own scope.** `pos-cli logsv2 search` had been broken since
the ESM migration (`862db40`, released in 6.0.0): `lib/swagger-client.js` assigned to an undeclared
`query`, which CommonJS tolerated and an ES module does not, so every search threw
`ReferenceError: query is not defined` and the bin's `catch` printed it as though the instance had
refused. Fixed, with three regression tests that drive the search path rather than the helper.
The repository has no linter, which is how an implicit global survived a migration to strict-mode
modules; `no-undef` would have caught it at the time.
<!-- SECTION:NOTES:END -->
