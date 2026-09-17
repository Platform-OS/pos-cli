---
id: TASK-15
title: >-
  Move mcp-min's protocol layer to MCP TypeScript SDK v2 (spec 2026-07-28,
  dual-era)
status: To Do
assignee: []
created_date: '2026-09-17 06:30'
updated_date: '2026-09-17 09:40'
labels:
  - mcp
  - refactor
dependencies:
  - TASK-14
  - TASK-16
references:
  - mcp-min/stdio-server.js
  - mcp-min/http-server.js
  - mcp-min/index.js
  - mcp-min/validate-params.js
  - mcp-min/schemas/default.js
  - mcp-min/tools.js
  - lib/validation/index.js
  - lib/ai.js
  - bin/pos-cli-mcp.js
  - docs/MCP_TOOLS.md
  - docs/SSE_GUIDE.md
  - examples/mcp-client.js
  - examples/python-client.py
documentation:
  - 'https://modelcontextprotocol.io/specification/2026-07-28/changelog'
  - 'https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning'
  - >-
    https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio
  - >-
    https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
  - 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools'
  - 'https://ts.sdk.modelcontextprotocol.io/v2/'
  - 'https://www.npmjs.com/package/@modelcontextprotocol/server'
priority: high
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: pos-cli's MCP server conforms to MCP 2026-07-28 and still serves clients on earlier revisions. Tool failures reach clients and models the way the spec defines.

## Current server (verified 2026-09-17)
Protocol, in `mcp-min/stdio-server.js` and the JSON-RPC branch of `mcp-min/http-server.js`:
- `ping` returns -32601. Legacy revisions require an answer.
- It replies to notifications: `notifications/cancelled` makes it write an error with no id to stdout. JSON-RPC forbids replies to notifications, and clients send this one whenever a user interrupts a tool call.
- `initialize` always answers with `2024-11-05`, whatever version the client asks for. `serverInfo.version` is hardcoded to `0.1.0`.
- Tool failures are not marked as failures:
  - `{ok:false}` results go out as ordinary content, without `isError`.
  - Thrown errors become JSON-RPC -32000.
  - The spec's tools page treats API failures, input validation and business-logic errors as tool results with `isError: true`.
- 2026-07-28 support is missing entirely: no `server/discover` (a MUST), no `_meta` envelope, no -32022, no `resultType`, no `ttlMs`/`cacheScope`.

HTTP:
- TASK-16 fixes, before this migration, the all-interfaces bind with no authentication, the missing Host/Origin validation, and the bind failure reported as success. This task must keep that behaviour and its 403 response contract unchanged.
- `/call`, `/call-stream`, `/tools` and the `GET /` SSE stream are custom endpoints. `GET /` resembles the HTTP+SSE transport, which 2026-07-28 marks Deprecated.

## SDK assessment (installed and probed, not just read)
- `@modelcontextprotocol/sdk` 1.30.0, already in our tree through the supervisor package, supports protocol versions only up to `2025-11-25`. It cannot meet 2026-07-28.
- `@modelcontextprotocol/server` 2.0.0 (+ `/stdio`) and `@modelcontextprotocol/express` 2.0.0: published 2026-07-27, need node >=20, depend on zod ^4.2, and describe themselves as the stable line implementing 2026-07-28. A probe server built with `serveStdio(factory)` showed:
  - **2026-07-28 client:**
    - `server/discover` returns `supportedVersions:["2026-07-28"]`, `resultType`, `ttlMs`, `cacheScope`, and `serverInfo` in `_meta`.
    - Requesting version `1900-01-01` returns -32022 with the supported list.
    - A request without `clientCapabilities` returns -32602.
    - `ping` returns -32601, as it was removed in this revision.
  - **Legacy client:** `initialize` negotiates 2025-06-18, `ping` returns `{}`, and `notifications/cancelled` produces no output.
  - **Schemas and errors:** `fromJsonSchema(schema, validator?)` publishes a raw JSON Schema byte-identical. Schema violations and thrown handler errors both come back as `isError:true`.
  - **Lifecycle:** the process exits on stdin EOF when nothing else holds the event loop.
  - **HTTP:** `createMcpExpressApp` defaults to 127.0.0.1 with Host and Origin validation. Its 403 responses match TASK-16's contract. `createMcpHandler({legacy:'stateless'})` serves 2025-era clients and answers GET/DELETE with 405.

Verdict: move to SDK v2 for the protocol layer only; tools are not rewritten.
- Tool modules, handlers, `tools.config`, `resolveAuth` and Ajv enforcement stay.
- No zod schemas. Going through zod would break CLAUDE.md's "the schema we publish and the schema we enforce are the same object" and would mean re-authoring 35 schemas.
- Instead, raw schemas go through `fromJsonSchema` with a validator adapter over `lib/validation`.

## Decisions
- **Dual-era by default:** stdio uses legacy `serve`, HTTP uses legacy `stateless`. The Claude Code, Cursor and VS Code configs written by `pos-cli ai init` must keep working whichever revision the client speaks.
- **Schema dialect.** Tool schemas are enforced as JSON Schema 2020-12, which 2026-07-28 assigns to any schema without `$schema`; lib/validation uses draft-07 today.
  - Rejected alternative: emit `$schema` (draft-07) on every tool, which adds bytes to every `tools/list`.
  - The keywords in use mean the same in both dialects.
- **Validation failures become tool results.** A failed argument validation returns `isError:true`, as the spec classifies it, replacing today's -32602.
  - This changes the CLAUDE.md enforcement table and the MCP mapping in `rejectionFor`.
  - An uncompilable schema (-32603) and an unknown tool remain protocol errors.
- **Handler failures:** `{ok:false}` results and thrown errors return `isError:true`, with the code and message in the text. No `structuredContent`/`outputSchema`, which would put the payload in the output twice.
- **Annotations:** set `annotations.readOnlyHint:true` on genuinely read-only tools only. Omitted hints already mean "may be destructive", which is correct for the rest and costs no bytes.
- **HTTP:**
  - Serve the SDK's Streamable HTTP endpoint at `/mcp`.
  - Keep TASK-16's host, allowlist and bind-failure behaviour for `/mcp` and the legacy routes.
  - If the app is built with `createMcpExpressApp`, always pass `allowedHosts`/`allowedOrigins` explicitly (loopback plus `MCP_MIN_ALLOWED_HOSTS`). Without an explicit allowlist the SDK skips Host validation on non-loopback binds, which would regress TASK-16. Otherwise keep TASK-16's middleware.
  - Legacy `/call`, `/call-stream`, `/tools` and `GET /` stay for 6.x, marked deprecated, and are removed at the next major.
- **`--no-http`** runs stdio only. `pos-cli ai init` writes it, because stdio clients never use the listener and the listener is what causes port races.
- **Cancellation:** handle `notifications/cancelled` on stdio and a closed response stream on HTTP by passing an AbortSignal to handlers.
- **Removals and identity:**
  - Remove the non-MCP stdio "direct method" invocation (`{"method":"envs-list"}`) and record it in the CHANGELOG.
  - `serverInfo` becomes `pos-cli-mcp` with the package version.
- **Out of scope:** `pos-cli-supervisor` (SDK 1.x) stays legacy-only, and modern-only clients will fail against it. That follow-up belongs in platformos-tools.

## Dependencies
- Depends on TASK-14: its stdin-EOF shutdown and argument parser must survive the transport swap.
- Depends on TASK-16: its HTTP exposure fix, whose contract this task must preserve.
- Coordinate with TASK-13:
  - both change the canonical args in `lib/ai.js`
  - transports take the resolved tool registry; whichever task lands second adapts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Over stdio, a 2026-07-28 client gets a conformant `server/discover` (supportedVersions includes 2026-07-28, tools capability, serverInfo with package name and version) and conformant `tools/list`/`tools/call` results; a conformance test drives these raw messages
- [ ] #2 Over stdio, legacy clients opening with `initialize` at 2025-11-25, 2025-06-18 and 2024-11-05 negotiate their version and can list and call tools; `ping` is answered on legacy connections
- [ ] #3 An unsupported protocol version yields -32022 with the supported list, a request missing required `_meta` yields the spec error, and no message is ever written in response to a notification (tested with `notifications/cancelled` and an unknown notification)
- [ ] #4 Every tool's published inputSchema is byte-identical to the object used for enforcement, and every tool schema compiles under JSON Schema 2020-12 in strict mode
- [ ] #5 Argument validation failures, handler `{ok:false}` results and thrown handler errors are returned as tool results with `isError: true` carrying the error code and message; an unknown tool remains a protocol error
- [ ] #6 Cancelling an in-flight call (`notifications/cancelled` on stdio, closed response stream on HTTP) stops long-running polls, and no further message is sent for that request
- [ ] #7 HTTP serves `/mcp` per Streamable HTTP 2026-07-28, including MCP-Protocol-Version, Mcp-Method and Mcp-Name validation (400 / -32020), serves 2025-era clients statelessly, and answers GET and DELETE on `/mcp` with 405
- [ ] #8 TASK-16's loopback default, Host/Origin validation with its 403 response contract, non-loopback opt-in and bind-failure reporting apply unchanged to `/mcp` and the legacy routes; TASK-16's tests pass without modification and cover `/mcp`
- [ ] #9 `--no-http` starts stdio only with no listener, and `pos-cli ai init` writes it for stdio clients
- [ ] #10 Legacy `/call`, `/call-stream`, `/tools` and `GET /` keep working in 6.x and are documented as deprecated; direct stdio method invocation is removed and recorded in CHANGELOG
- [ ] #11 Read-only tools carry `annotations.readOnlyHint: true`, and a test pins the annotated set to a reviewed list
- [ ] #12 TASK-14's stdin-EOF shutdown and, if landed, TASK-13's tool selection behave identically after the migration; their tests are ported, not deleted
- [ ] #13 CLAUDE.md (MCP Server Pattern, Input Validation enforcement table and -32602 rule), README, docs/MCP_TOOLS.md, docs/SSE_GUIDE.md and CHANGELOG describe the protocol revision, error mapping, `/mcp`, `--no-http` and the deprecations
- [ ] #14 With the configuration `pos-cli ai init` writes, several concurrent MCP client sessions (e.g. three Claude Code sessions) start without any HTTP bind attempt: no `HTTP transport not started (EADDRINUSE)` line in stderr or `~/.pos-cli/logs/mcp-min.log`, and no process listens on 5910; re-running `pos-cli ai init` upgrades an existing `platformos` entry that lacks `--no-http`, and CHANGELOG tells users to re-run it
- [ ] #15 A project `.mcp.json` shared across a team works on every pos-cli version its members run: a release that writes `--no-http` must not ship after a release whose strict argument parser (TASK-14) rejects it; ship them together, or make the TASK-14 parser accept `--no-http` first; covered by a test that starts `pos-cli-mcp --no-http` on the release that introduces the flag
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Related: TASK-14 (invocation + stdin-EOF lifecycle, lands first), TASK-16 (HTTP localhost/Host/Origin/bind-failure fix, lands first; its contract is preserved here), TASK-13 (tool selection + job-status; both change `lib/ai.js` canonical args), TASK-11 (header logging, same http-server.js), TASK-5 (dispatch guard; the SDK dispatch replaces the stdio/JSON-RPC paths, legacy HTTP paths keep the guard).

Before coding, confirm the API against the v2 docs (https://ts.sdk.modelcontextprotocol.io/v2/). The names below were confirmed by a runtime probe: `McpServer`, `fromJsonSchema`, `serveStdio`, `createMcpExpressApp`, `createMcpHandler`, `validateOriginHeader`, `localhostAllowedOrigins`. These still need confirming: how the handler context exposes the progress token, the notification sender and the AbortSignal, and whether `registerTool` order is preserved in `tools/list` (the spec asks for deterministic order).

1. Add `@modelcontextprotocol/server` and `@modelcontextprotocol/express` (^2.0.0). Record the install-size delta and `npm ls zod @modelcontextprotocol/sdk @modelcontextprotocol/server`.
2. Validation (`lib/validation/index.js`):
   - Add a 2020-12 build (`ajv/dist/2020`) with the same strict/allowUnionTypes/ajv-formats configuration, selected with `validate(schema, data, { dialect: '2020-12' })`. GUI schemas keep draft-07.
   - `mcp-min/protocol/validator.js` adapts it to the SDK's `jsonSchemaValidator` interface, so enforcement stays in one module.
   - Test: every registered tool schema compiles under 2020-12 strict.
3. `mcp-min/protocol/server-factory.js`:
   - `createServer(tools)` → `new McpServer({ name: 'pos-cli-mcp', version: pkg.version }, { capabilities: { tools: {} } })`.
   - For each exposed tool, in registry order: `registerTool(name, { description, inputSchema: fromJsonSchema(tool.inputSchema, validator), annotations })`.
   - The callback builds the handler ctx (`transport`, `debug`, `sendProgress` when a progress token is present, `signal`) and maps results: `{ok:false}` or a thrown error → `{ content:[{type:'text', text: JSON.stringify(errorPayload)}], isError:true }`; anything else → text content with the JSON.
   - Test: the published inputSchema is `===`/byte-identical to `tool.inputSchema`.
4. `mcp-min/stdio-server.js`:
   - `serveStdio(() => createServer(tools), { legacy: 'serve', onerror })`.
   - Remove the hand-rolled readline dispatcher and the direct-method fallback.
   - Keep the TASK-14 lifecycle: the process-level exit stays in `mcp-min/index.js`, since the HTTP listener keeps the loop alive, and `--cwd` keeps working on the direct-run path.
5. `mcp-min/http-server.js`:
   - Keep TASK-16's `readHttpConfig`, host-validation contract and listen/error handling.
   - Mount `createMcpHandler(() => createServer(tools), { legacy: 'stateless' })` at `/mcp` behind the same Host/Origin middleware.
   - Replace TASK-16's middleware with `createMcpExpressApp({ host, allowedHosts, allowedOrigins, jsonLimit: '1mb' })` only if TASK-16's tests pass unchanged. Always pass the allowlists explicitly: the SDK skips Host validation on non-loopback binds without them.
   - Legacy routes stay mounted on the same app; keep `rejectionFor` there (400/500).
6. `bin/pos-cli-mcp.js`: `--no-http` skips `startHttp` (and `readHttpConfig`'s exposure warning). `lib/ai.js` adds `--no-http` to the canonical args, coordinated with TASK-13's canonical-form upgrade list.
7. Cancellation: pass the SDK signal into ctx and use it in long polls (`logs-fetch` if it loops, TASK-13 `job-status` wait, `deploy-wait`).
8. Annotations: `readOnlyHint: true` for envs-list, logs-fetch, generators-list, generators-help, migrations-list, constants-list, data-validate, partners-list, partner-get, endpoints-list, and the status tools (deploy-status, deploy-wait, data-*-status, tests-run-async-result, job-status). Not for graphql-exec or liquid-exec (they can mutate), and not for check-run (it has an autofix mode). A test pins the list.
9. Tests:
   - `mcp-min/__tests__/protocol-conformance.test.js`: spawn the stdio server and drive raw JSON-RPC.
     - modern: discover, tools/list, tools/call, unsupported version → -32022, missing `_meta` → -32602, ping → -32601
     - legacy: initialize at 2025-11-25, 2025-06-18 and 2024-11-05, tools/list, tools/call, ping
     - no output for notifications
     - isError for a validation failure, `{ok:false}` and a thrown error
     - cancellation stops a slow fake tool
   - `mcp-min/__tests__/http-mcp-endpoint.test.js`: a modern request with and without the required headers (400 / -32020), GET/DELETE `/mcp` → 405, a legacy stateless request.
   - Extend TASK-16's `http-exposure.test.js` route list with `/mcp` without changing its other assertions.
   - Port `stdio.test.js`, `http.test.js`, `transport-validation.test.js`, `sse.test.js` and `validate-params.test.js`. Update assertions from -32602 to isError where the spec requires it; keep legacy HTTP 400 assertions.
10. Docs:
    - CLAUDE.md: MCP Server Pattern, the Input Validation enforcement table and the -32602/-32603 rules (MCP transports now report validation failures as `isError`, schema compile failures stay -32603).
    - README MCP section, docs/MCP_TOOLS.md (`/mcp` documented; legacy endpoints deprecated), docs/SSE_GUIDE.md, mcp-min/README.md, CHANGELOG (direct stdio method invocation removed, error-mapping change).
11. Manual DoD: Claude Code config from `pos-cli ai init`, and MCP Inspector against stdio and `/mcp`.

Repro used when filing:
- **Protocol:** stdio lines initialize (2025-06-18) → answered with `2024-11-05`; `ping` → -32601; `notifications/cancelled` → an id-less error line; a tool with bad auth → result content `{ok:false…}` with no isError.
- **SDK v2 probe:** in a scratch dir, `npm i @modelcontextprotocol/server@2.0.0`. Build a `serveStdio` factory with `McpServer.registerTool(name, { inputSchema: fromJsonSchema(schema) })` and drive the modern and legacy sequences above. Results as listed in the description.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-16 implementation (2026-09-17), names to use when preserving its contract:
- **Config.** `mcp-min/http-config.js` `readHttpConfig(env)` → `{ host, port, allowedHostnames, exposed }`. It is pure: no logging. It throws `HttpConfigError` for malformed values and also validates `MCP_MIN_PORT`, which the TASK-16 description did not originally list.
- **Exposure warning and bind-outcome logs.** These live in `mcp-min/index.js` `startHttpTransport`, not in `readHttpConfig`. So `--no-http` (plan step 6) skips `startHttpTransport`. Decide there whether a malformed `MCP_MIN_*` still fails startup under `--no-http`; failing closed is the safer reading.
- **Host/Origin check.** `mcp-min/host-validation.js` exports `checkHost`/`checkOrigin` plus the `hostValidation(allowedHostnames)` middleware. Messages match `@modelcontextprotocol/express` 2.0.0, including `Invalid Host header: <raw>` for an unparseable Host, which the TASK-16 description's list omitted. The middleware is registered after the request logger and before `bodyParser`.
- **Tests to keep green unmodified:**
  - `http-config.test.js` (unit)
  - `http-exposure.test.js` (route × rejection matrix, spies, middleware order, bind address). Extend its `ROUTES` with `/mcp`.
  - `http-startup.test.js` (spawned bin: malformed config, EADDRINUSE incl. wildcard holder, EADDRNOTAVAIL, EACCES, bound-address log, `MCP_MIN_HOST=0.0.0.0` warning)
- **Mutation check.** 29 mutants were run against these tests and all were killed. The list is in TASK-16's implementation notes; the script itself was not committed. Re-run the relevant mutants after the swap, especially "validation after bodyParser/router", "allowlist not passed" and "bind error resolving".

## Observed after TASK-16 landed (2026-09-17): why `--no-http` is the proper fix for bind noise
- **What happened.** After the user restarted their editors, three Claude Code sessions each launched `pos-cli-mcp` through the config `pos-cli ai init` writes.
  - The first (`~/Work/pos-opencode-app/test-instance`) bound `127.0.0.1:5910`.
  - The next ones logged `[ERROR] mcp-min: HTTP transport not started (EADDRINUSE): 127.0.0.1:5910 is already in use by another process. If that is an older pos-cli-mcp, it is bound to all interfaces without Host/Origin checks: stop it or restart the MCP client…`. That is three ERROR lines in ~/.pos-cli/logs/mcp-min.log within a minute.
  - Stdio worked in all of them.
- **Why it matters.** This is the normal multi-session case, not a fault. It still produces an ERROR with an alarming hint, and the HTTP listener goes to whichever session started first. That session's `.pos` credentials then serve every HTTP caller, even though none of these stdio clients use HTTP.
- **Rejected alternative.** Probe the port holder after EADDRINUSE: a 403 to a bad Host means a fixed server, so downgrade the log; a 200 means an old exposed server, so keep the ERROR. It only quiets the symptom; the listener and the credential mix-up remain. The fix is not to open the listener at all for stdio sessions: `--no-http` in the args `pos-cli ai init` writes (plan step 6, AC #9).
- **Keep the EADDRINUSE diagnostics from TASK-16** for explicit HTTP use (no `--no-http`), where the older-server hint is still the right advice.
- **Compatibility risk with TASK-14.** TASK-14 makes `pos-cli-mcp` reject unknown options, so no transport starts. `.mcp.json`, `.cursor/mcp.json` and `.vscode/mcp.json` are project-scoped and usually committed, so one team shares a config across pos-cli versions:
  - pre-TASK-14 releases ignore argv, so `--no-http` is harmless
  - a release with TASK-14 but without `--no-http` would refuse to start
  
  Either release TASK-14 and this task together, or teach TASK-14's parser `--no-http` before any release that writes it. The decision is recorded as an AC.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 PR records the install-size delta and `npm ls zod @modelcontextprotocol/sdk @modelcontextprotocol/server` output after adding SDK v2
- [ ] #2 Manually verified against at least one real MCP client (e.g. Claude Code via `pos-cli ai init`) and against MCP Inspector, recorded in the PR
<!-- DOD:END -->
