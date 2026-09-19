---
id: TASK-23.2
title: >-
  MCP: rewrite tool and parameter descriptions to a single standard, removing
  the duplicated prose
status: Done
assignee: []
created_date: '2026-09-18 17:13'
updated_date: '2026-09-18 18:47'
labels:
  - mcp
  - agent-facing
dependencies:
  - TASK-23.1
references:
  - 'https://www.anthropic.com/engineering/writing-tools-for-agents'
  - 'https://modelcontextprotocol.io/specification/2025-06-18/server/tools'
  - mcp-min/schemas/auth.js
  - mcp-min/__tests__/tool-surface.test.js
  - docs/MCP_TOOLS.md
parent_task_id: TASK-23
priority: high
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The descriptions were written tool by tool as each tool landed, against no standard, and were never reviewed as a set. They are the layer that decides whether an agent picks the right tool and calls it correctly, and they are the largest prose payload the server sends.

MEASURED, on this branch (registry of 36, 35 exposed by default):

- tools/list is 25,152 bytes for `--profile full` (~6,800 tokens) and 6,812 bytes for `--profile dev`.
- Tool descriptions are 4,136 bytes of that (16%). **Parameter descriptions are 8,420 bytes across 166 parameters (33%)** — twice the cost, and never reviewed at all.
- Prose is half the payload: 50% for full, 54% for dev.
- **49% of all parameter prose is duplicate copies.** The auth triple alone costs 3,312 bytes restating one fact 24 times: `url` ×24 "Instance URL (with email and token, bypasses .pos)", `email` ×24, `token` ×24, plus `env` ×13 "Environment name from .pos config" and ×3 in a longer variant. These come from the shared `authProperties` spread (mcp-min/schemas/auth.js), so the repetition is structural, not accidental.

THE STANDARD to write against, from Anthropic's "Writing effective tools for AI agents", the MCP tools specification, and the measurements above:

1. Address the model as a new hire: make implicit context explicit — the terminology, the relationships between resources, the sequencing — and leave out what it cannot act on. No API endpoint paths (`/api/app_builder/liquid_exec`), no internal module names, no HTTP verbs. Those are 100% cost and 0% signal.
2. Open with the verb and what happens ("Deploy…", "List…"), never "A tool for…".
3. Say when NOT to use it and how it differs from its nearest neighbour. Ambiguous, overlapping tools are the top documented failure mode, and this server has real neighbours: `check` vs `check-run`, `unit-tests-run` vs `tests-run-async`, `data-validate` vs `check-run`, `job-status` vs the six deprecated status tools.
4. State what comes back only where the model must act on it — "returns a job_id; poll it with job-status" earns its bytes; "returns JSON" does not.
5. Placement rule, which is what removes the duplication: a fact true of every tool goes in the server instructions once (TASK-23.3); a fact about one parameter goes in that parameter's description; only a fact about this tool's behaviour goes in the tool description. The auth triple and the `env` fallback are instructions-level facts and must stop being repeated per tool.
6. Parameter descriptions are short noun phrases, not tutorials, and never restate the parameter's name, type or default — the schema already carries those. A parameter whose description adds nothing beyond its name loses the description.
7. Annotations are part of this layer and are currently incomplete: only `readOnlyHint` is used anywhere. `data-clean` announces "DESTRUCTIVE" in prose while carrying no `destructiveHint`, so a client that gates destructive tools has nothing to gate on. Set the hints the MCP spec defines where they are true, and let the prose stop doing that job.

GOTCHAS ARE PART OF THE JOB. An agent reaches for these tools to *verify* things, and a tool that answers successfully will be read as having verified something. Where that reading is wrong, the description must say so — this is the highest-value sentence a description can carry, and it is a fact about this tool's own result, not about the wider platform:

- `graphql-exec` is not a validator. It executes the document against a live instance, so a mutation run "to check it" has already written the data, and a call that comes back without errors proves only that this instance accepted this document with these variables — not that the document is correct. Errors arrive in the result body as `ok:false` / `GRAPHQL_EXEC_ERROR` rather than as a failed call, so an agent that only checks whether the call succeeded will read a rejected query as a success.
- `liquid-exec` renders; it does not prove the code deploys. The deploy converter rejects source the Liquid evaluator accepts, so a successful render is not evidence of deployability.
- `check-run` findings are meant to be read by check code. A pass/fail verdict hides that some checks report at error severity without being deploy-fatal, and that others do not fire at all.

The line to hold: describe what THIS tool does and what its result does and does not establish. Do not turn a description into a reference for the platformOS GraphQL schema or the Liquid language — `record_delete`'s required `table` is the schema's business, and a per-request token cost besides. Verify every such claim against pos-cli's actual behaviour before writing it down.

Note: `tools.config.json` must no longer carry these descriptions before this work starts, or every edit here is dead on arrival — see TASK-23.1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every exposed tool's description opens with what the tool does, and distinguishes it from any tool it could be confused with
- [x] #2 No description contains an API endpoint path, internal module name or HTTP verb
- [x] #3 No parameter description is repeated verbatim across tools, and a test fails if one ever is again — including a tool that overrides a shared parameter with the text it already had
- [x] #4 No parameter description restates only the parameter's name, type or default
- [x] #5 The auth parameters (url/email/token) and the `env` fallback are described in one place, not once per tool
- [x] #6 Tools that change state carry the MCP annotation that says so, and `data-clean`, `constants-unset` and a deleting `sync-file` are not identified as destructive by prose alone
- [x] #7 tools/list is measurably smaller for both `full` and `dev` than the 25,764 / 6,920 bytes measured before this task, and the new sizes are pinned by the existing byte tests
- [x] #8 Neighbouring tools each state when to prefer the other: unit-tests-run vs tests-run-async, data-validate vs check-run, job-status vs the deprecated status tools
- [x] #9 Every tool an agent could mistake for a validator says what its result does not establish: graphql-exec executes against a live instance and is not a correctness check, liquid-exec rendering is not evidence of deployability, check-run findings are read by check code not by a verdict
- [x] #10 graphql-exec's description warns that a mutation run to verify a document has already written the data, and that errors come back in the result body rather than as a failed call
- [x] #11 No description becomes a reference for the platformOS GraphQL schema or the Liquid language, and every behavioural claim is verified against pos-cli before shipping
- [x] #12 docs/MCP_TOOLS.md names no parameter a tool does not declare, and a test keeps it that way
<!-- AC:END -->
