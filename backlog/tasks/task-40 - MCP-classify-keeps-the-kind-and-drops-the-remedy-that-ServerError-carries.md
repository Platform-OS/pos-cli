---
id: TASK-40
title: 'MCP: classify keeps the kind and drops the remedy that ServerError carries'
status: To Do
assignee: []
created_date: '2026-09-22 06:43'
labels:
  - mcp
  - agent-facing
  - errors
dependencies: []
references:
  - lib/ServerError.js
  - mcp-min/tool-error.js
  - mcp-min/auth.js
  - mcp-min/instructions.js
priority: high
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by comparing the CLI and the MCP path after an agent-perspective evaluation (2026-09-21) and a report from the field: `pos-cli tests run` prints *"Tests module not found. Please install the tests module: pos-cli modules install tests"*, while the MCP tool answered a bare 404.

That one is fixed (`mcp-min/tests/module-check.js`), and it is an instance of a general pattern.

**The CLI routes every API failure through `lib/ServerError.js`.** It has a handler per status, and each one carries a remedy or at least tells the operator not to bother reporting it. The MCP server deliberately replaced that with `classify` (`tool-error.js`) — necessarily, since `ServerError` prints and calls `process.exit`. But `classify` kept the *kind* and dropped the *advice*.

What `ServerError` says that the MCP path does not:

| case | the CLI says | MCP answers |
|---|---|---|
| 413 | "Archive you are trying to send is too large. Limit is 50MB." | bare `instance` + status |
| 503 `partner_portal_unavailable` | "This Instance could not reach the Partner Portal to verify your API token", with a clamped Retry-After, and that nothing is wrong with the token | generic `unavailable` (except in `job-status`, wired for TASK-39) |
| `ENOTFOUND` / `ECONNREFUSED` | distinguishes them, names the host | `unavailable`, one message for all |
| 502 / 504 / 500 | "We have been notified about it" — worth knowing, it stops an agent reporting it | bare kind |
| unknown env | `lib/settings.js`: "please see pos-cli env add" | `ENV_NOT_FOUND` with no next step |

TASK-30 established the shape for this — `details.remedy = { command, runBy }` — and the tests-module fix reuses it, so the pattern is set and the work is to apply it.

Two smaller findings from the same evaluation belong here, because they are the same surface:

- **`ENV_NOT_FOUND` does not list the environments** although `resolveAuth` has them in hand. It costs the agent an extra `envs-list` round trip, and `ENV_REQUIRED` already lists them.
- **`kind: "project"` is not in the documented taxonomy.** The instructions enumerate `input`, `not_found`, `auth`, `instance`, `unavailable` and promise "the kind says what to do next"; the evaluator's second call returned `kind: "project"`, `code: NO_DIRECTORIES`. Either document it or fold it into `input`. `ERROR_KINDS` has eight members and the instructions list five.

Do not port `ServerError`'s exit/print behaviour, and do not make every error grow prose: the remedy is a field, only where there is one to name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A 413, a Partner Portal outage and a DNS/connection failure each carry what the CLI tells an operator, in details.remedy where there is a command and in the message otherwise
- [ ] #2 ENV_NOT_FOUND lists the environments that are configured, as ENV_REQUIRED already does
- [ ] #3 Every kind ERROR_KINDS defines is either named in the server instructions or removed from the set
- [ ] #4 No error kind gains prose it has no remedy for, and the instructions do not grow a per-status list
- [ ] #5 Tests drive each case through runTool and assert the field, not the wording
<!-- AC:END -->
