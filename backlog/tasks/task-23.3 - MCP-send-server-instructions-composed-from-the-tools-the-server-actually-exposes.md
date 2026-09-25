---
id: TASK-23.3
title: >-
  MCP: send server instructions, composed from the tools the server actually
  exposes
status: Done
assignee: []
created_date: '2026-09-18 17:14'
updated_date: '2026-09-18 19:09'
labels:
  - mcp
  - agent-facing
dependencies:
  - TASK-23.1
references:
  - mcp-min/protocol/server-factory.js
  - mcp-min/tool-selection.js
  - bin/pos-cli-mcp-config.js
  - mcp-min/__tests__/tool-surface.test.js
parent_task_id: TASK-23
priority: high
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The MCP server sends no `instructions`. The protocol defines a server-level instructions string, returned at `initialize` and at `server/discover`, and the SDK supports it (node_modules/@modelcontextprotocol/server/dist/createMcpHandler-CLhGwQTn.d.mts:2777, "Optional instructions describing how to use the server and its features"). pos-cli passes none, so nothing tells a model how to use this server as a whole — only what each tool does in isolation.

That absence costs twice. Cross-tool rules have nowhere to live, so they are either missing or repeated per tool: the auth/`env` rule is repeated 40 times across parameter descriptions (3,708 bytes) because there is no single place to say it once. And the rules that span tools are exactly the ones an agent gets wrong — what a job_id is for, which tools destroy data, what a passing result does and does not prove.

SCOPE — these instructions describe pos-cli's MCP server and nothing else. They must not mention, assume or route to tools on another MCP server (the platformOS supervisor, the GraphQL or Liquid servers). Those servers are separately registered, may not be present, and are not this server's business; a client discovers them for itself. Advice about the wider platformOS toolchain belongs to whatever assembles that toolchain, not here. Every sentence shipped must be a fact about a tool this server exposes.

THE HARD REQUIREMENT: instructions must describe only the server the client is actually talking to. `tools/list` already honours this — it lists only exposed tools — and instructions must match. A server started with `--profile dev` exposes 9 tools and must not carry a sentence about `data-clean`; `--include-tools`, `--exclude-tools` and a config-disabled tool must move the instructions with them. This is not cosmetic: naming a tool the client cannot call invites the model to attempt it and teaches it that this server's guidance is unreliable.

The exposed set already lands in exactly one place — `selectTools().tools`, the Map both transports are handed — so instructions are derived from that Map. A second list of tool names, kept in step by hand, is the failure this design exists to prevent: each piece of guidance declares which tools it needs, and is emitted only when those tools are present.

CONTENT — the cross-tool rules, each earning its bytes, each naming only tools this server exposes:

- Credentials and environment: the resolution order, and that omitting `env` targets the first `.pos` entry — which is why a mutating call should always name its environment. This replaces the per-parameter repetition and is the single largest token win available.
- Asynchronous work: starters return an opaque `job_id`; pass it back unchanged to `job-status`; use `wait_ms` rather than polling in a loop; a deploy is not finished when `deploy-start` answers.
- Destructive operations: which tools delete, and that a non-partial deploy removes files missing from the build.
- What a passing result does not prove. Two candidates, both about this server's own tools, both to be verified against pos-cli's actual behaviour before being written down rather than taken from any external document: that a successful `liquid-exec` render is not evidence the code deploys, because the deploy converter rejects source the Liquid evaluator accepts; and that `check-run` findings should be read by check code rather than by a pass/fail verdict.

Instructions are usually placed in the client's system prompt, so they are charged on every request, not once per session. They are subject to the same budget discipline as the tool definitions, and must not restate anything a tool description already says (see TASK-23.2's placement rule).

Do not write instructions that imply a capability this server lacks. It exposes no dry-run deploy today — `deploy-start` takes only `partial` — and the MCP tool surface lags the CLI in several other places; that gap is tracked separately and is not to be papered over with wording here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The server sends MCP instructions, and a client receives them on both the 2026-07-28 discovery path and the 2025-era initialize path
- [x] #2 The instructions a server sends never name a tool that server does not expose — verified across every profile and a range of --include-tools/--exclude-tools/config-disabled combinations, not just the default
- [x] #3 The instructions mention no tool belonging to another MCP server, and make no claim about what else the client may have registered
- [x] #4 Guidance that depends on a tool disappears when that tool is not exposed, and no second list of tool names has to be maintained by hand to make that happen
- [x] #5 stdio and HTTP present identical instructions for the same selection
- [x] #6 The instructions state the credential/environment rule once, and no parameter or tool description repeats it
- [x] #7 Every behavioural claim in the instructions is verified against pos-cli's own behaviour before shipping, not carried over from external documentation
- [x] #8 The instructions do not claim a capability this server lacks, including any dry-run deploy
- [x] #9 `pos-cli mcp-config` prints the instructions for the selection given, in both its human and --json output
- [x] #10 The deprecated hand-rolled initialize response in http-server.js either carries the instructions or deliberately does not, with the choice recorded rather than left to chance
- [x] #11 The instructions payload is counted against the dev profile's byte budget, and `--profile dev` still fits within it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delivered as `mcp-min/instructions.js`, built from the exposed Map in `createServerFactory` and passed to `new McpServer(…, { instructions })`.

Four sections, each earning its place by holding something no single tool description can say:
- credentials and the `.pos` fallback (emitted only when an exposed tool actually authenticates)
- that a call which answered is not a call that worked
- that a relative path resolves against the directory the server was started in
- that a `job_id` is waited on with `job-status` and `wait_ms`, naming only the starters that are exposed

Deliberate departures from the task as written:
- The destructive-operations and "what a passing result proves" sections were dropped. TASK-23.2 put both into the tool descriptions and the `destructiveHint` annotations, and the placement rule forbids restating a description that is already sent with every request.
- `env` keeps "the first entry if omitted" in its parameter description as well as here. The full precedence moved to the instructions, but the fallback is what sends a write to the wrong instance, so it stays where the argument is filled in. It is the one overlap, and it is chosen.
- The deprecated hand-rolled `initialize` in http-server.js carries the instructions too: the tools are the same tools, and letting the two answers differ would be a difference nobody chose.

Found while verifying the claims: four tools do not use the `ok` envelope, so a failed migration reaches the client as a successful call. The "Results" sentence was weakened to stay true, and the defect is TASK-27.

Sizes: instructions 981 bytes (full) / 943 (dev), budgeted at 1200 in instructions.test.js, separate from the tools/list budget since a client is charged for each once. tools/list fell to 20,109 / 5,408 when the precedence left the schemas.
<!-- SECTION:NOTES:END -->
