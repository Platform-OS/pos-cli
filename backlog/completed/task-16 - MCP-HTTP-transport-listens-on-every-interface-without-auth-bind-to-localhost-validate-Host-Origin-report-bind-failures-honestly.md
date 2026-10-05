---
id: TASK-16
title: >-
  MCP HTTP transport listens on every interface without auth: bind to localhost,
  validate Host/Origin, report bind failures honestly
status: Done
assignee: []
created_date: '2026-09-17 07:45'
updated_date: '2026-09-17 09:19'
labels:
  - bug
  - security
  - mcp
dependencies: []
references:
  - mcp-min/http-server.js
  - mcp-min/index.js
  - mcp-min/sse.js
  - bin/pos-cli-mcp.js
  - mcp-min/tools-config-error.js
  - mcp-min/__tests__/http.test.js
  - mcp-min/__tests__/sse.test.js
  - mcp-min/__tests__/transport-validation.test.js
  - docs/SSE_GUIDE.md
  - docs/MCP_TOOLS.md
  - mcp-min/README.md
  - README.md
  - CLAUDE.md
  - lib/server.js
  - Dockerfile
documentation:
  - >-
    https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
modified_files:
  - mcp-min/http-config.js
  - mcp-min/host-validation.js
  - mcp-min/http-server.js
  - mcp-min/index.js
  - bin/pos-cli-mcp.js
  - mcp-min/__tests__/http-config.test.js
  - mcp-min/__tests__/http-exposure.test.js
  - mcp-min/__tests__/http-startup.test.js
  - docs/SSE_GUIDE.md
  - docs/API.md
  - docs/MCP_TOOLS.md
  - mcp-min/README.md
  - README.md
  - CLAUDE.md
  - AGENTS.md
  - CHANGELOG.md
priority: high
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: only this machine can drive the MCP server's HTTP transport — non-browser clients, or pages served from localhost. Exposing it beyond loopback is a deliberate choice, logged on every start. The server never claims to be listening when it is not. This ships on the current hand-rolled server with no new dependencies, ahead of the SDK migration (TASK-15).

## Verified (2026-09-17, pos-cli 6.5.0, commit 0555c23)
- **Binds every interface.** `mcp-min/http-server.js` calls `app.listen(port, cb)` without a host, so it binds `*:5910` (`ss -ltnp`). Every `pos-cli-mcp` start opens this listener, including the stdio sessions that MCP clients launch.
- **Reachable and unauthenticated from the LAN.**
  - `GET http://<LAN-IP>:<port>/health` returned `{"status":"ok"}`, and `GET /tools` returned the tool list.
  - Neither `mcp-min/http-server.js` nor `mcp-min/sse.js` contains any authentication code.
  - `POST /call` runs any tool with the credentials the server resolves from its cwd `.pos` or `MPKIT_*`: data-clean (its confirmation string is public), constants-set, graphql-exec, deploy-start…
  - Anyone on the network can wipe instance data or deploy.
- **No Host or Origin validation.** Even on loopback, a web page can reach the server through DNS rebinding. MCP Streamable HTTP (2026-07-28): servers MUST validate `Origin` and answer 403 when it is invalid, and SHOULD bind 127.0.0.1 when running locally.
- **The docs promise protection that does not exist.** docs/SSE_GUIDE.md says "All requests require Bearer token authentication", and the cagent example in mcp-min/README.md sends `Authorization: Bearer <secret>`. Nothing checks either.
- **A failed bind is reported as success.** Express 5's `app.listen` hands the error to the callback. http-server.js ignores it, logs "HTTP server listening" and resolves (verified by starting a second server on the same port).
- **Why the bind-failure fix cannot wait for TASK-15.**
  - Binding `127.0.0.1:P` while an older pos-cli server holds `*:P` fails with EADDRINUSE, and requests to `127.0.0.1:P` are answered by the old process (verified).
  - Editors keep MCP servers alive for days: one on the machine used for this analysis had held `*:5910` for 8 days.
  - During an upgrade, the new server would say it is listening while localhost traffic goes to the old, exposed process. The fix would look applied when it is not.

## Decisions
- **Bind address.** Default to `127.0.0.1`. Not `localhost`, which can resolve to `::1` alone. Configurable through `MCP_MIN_HOST`, an env var to match the existing `MCP_MIN_PORT`. `pos-cli gui serve` already defaults to `localhost`, so this follows existing practice.
- **Host/Origin validation.**
  - Applied at app level to every route (`/`, `/health`, `/tools`, `/call`, `/call-stream`, unknown paths, and any route added later), before body parsing and before any handler.
  - Allowed hostnames: `localhost`, `127.0.0.1` and `[::1]`, plus `MCP_MIN_ALLOWED_HOSTS` (comma-separated). Only the hostname is compared; the port is ignored.
  - A missing or disallowed `Host` gets 403.
  - A present `Origin` whose hostname is not allowed, including `Origin: null`, gets 403.
  - No `Origin` at all is allowed (curl, SDK clients, the examples).
- **Response contract.**
  - Copied from MCP TypeScript SDK v2 (`@modelcontextprotocol/express` 2.0.0, confirmed by probing `createMcpExpressApp`): status 403 with body `{"jsonrpc":"2.0","error":{"code":-32000,"message":M},"id":null}`.
  - M is one of `Invalid Host: <hostname>`, `Missing Host header`, `Invalid Origin: <hostname>` or `Invalid Origin header: <value>`.
  - TASK-15 can then swap in the SDK's middleware without any change clients can see.
  - Written in-house (a small middleware); no SDK dependency, since this ships first.
- **Binding beyond loopback.**
  - Still possible, but only by setting `MCP_MIN_HOST` (e.g. `0.0.0.0`). The Dockerfile shows pos-cli runs in containers, where loopback is unreachable from the host.
  - Every start in that mode logs a WARN: anyone who can reach the port can run every exposed tool with this machine's credentials, without authentication.
  - Host/Origin validation still applies, with loopback names plus `MCP_MIN_ALLOWED_HOSTS` as the allowlist. The SDK skips Host validation for non-loopback binds that have no allowlist; we deliberately do not. Host validation is not authentication and does not stop LAN clients, but it still blocks DNS rebinding, so there is no reason to drop it.
- **Fail closed on malformed config.** These stop startup with one message before any transport starts:
  - an `MCP_MIN_HOST` that is neither an IP literal nor `localhost`
  - an `MCP_MIN_ALLOWED_HOSTS` entry that is empty or contains a scheme, port or path
  
  Otherwise a typo would leave an allowlist that silently never matches.
- **Report the real bind outcome.**
  - Resolve only on `listening`, and log the address actually bound.
  - On `error` (EADDRINUSE, EACCES, EADDRNOTAVAIL): log the code, host and port. For EADDRINUSE, add that another process holds the port, possibly an older pos-cli server exposed on all interfaces.
  - Never log "listening" after a failure.
  - Keep serving stdio: it is the primary transport, and exiting would drop MCP client sessions over an optional listener.
- **Docs.**
  - Remove the Bearer-auth claims.
  - State that the HTTP transport is unauthenticated and loopback-only by default, and what `MCP_MIN_HOST` and `MCP_MIN_ALLOWED_HOSTS` do and risk.
  - The CHANGELOG security entry tells users to restart running `pos-cli-mcp` processes: old ones keep the exposed port and absorb localhost traffic.

Not in scope: authentication for the HTTP transport; `--no-http` and the `/mcp` endpoint (TASK-15). Coordinate with TASK-11, which changes the request-logging middleware in the same file, and with TASK-14, which also logs the bound port (whichever lands second reuses it).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 By default the HTTP listener binds 127.0.0.1 only: `server.address().address` is `127.0.0.1`, and a connection to a non-loopback address of the machine is refused (the test is skipped with a reason when the machine has no non-loopback interface)
- [x] #2 Every route (`GET /`, `GET /health`, `GET /tools`, `POST /call`, `POST /call-stream`, and an unknown path) answers 403 with the documented JSON-RPC body for a disallowed Host, a missing Host, a disallowed Origin and `Origin: null`, with a test per route
- [x] #3 A rejected `POST /call` naming a destructive tool never invokes the tool handler and never resolves credentials (asserted with spies)
- [x] #4 Requests with Host `localhost`, `127.0.0.1` or `[::1]` on any port, carrying no Origin or a localhost-class Origin, behave as before; the existing http, sse and transport-validation tests pass with at most host setup changes
- [x] #5 `MCP_MIN_HOST=0.0.0.0` binds all interfaces, logs the unauthenticated-exposure warning on every start, and still applies Host/Origin validation with the allowlist extended by `MCP_MIN_ALLOWED_HOSTS`
- [x] #6 A malformed `MCP_MIN_HOST` or `MCP_MIN_ALLOWED_HOSTS` stops startup with one stderr message and a non-zero exit before any transport starts
- [x] #7 When the port is already taken, including by a listener on all interfaces, the server logs the error code, host and port, never logs that it is listening, and still answers MCP requests over stdio; on success the log shows the actual bound address
- [x] #8 docs/SSE_GUIDE.md and mcp-min/README.md no longer claim Bearer authentication; README, docs/MCP_TOOLS.md and CLAUDE.md state that the HTTP transport is unauthenticated and loopback-only by default and document `MCP_MIN_HOST`/`MCP_MIN_ALLOWED_HOSTS` and their risk; CHANGELOG has a security entry advising users to restart running `pos-cli-mcp` processes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Related: TASK-15 (SDK v2 migration; must keep this behaviour and response contract), TASK-14 (stdin-EOF lifecycle; its HTTP-only test uses `/health` on loopback), TASK-11 (request logging in the same file).

1. `mcp-min/http-config.js`: `readHttpConfig(env)` returns `{ host, allowedHostnames, exposed }`.
   - `LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]']`.
   - `MCP_MIN_HOST` defaults to `127.0.0.1` and must be `localhost` or `net.isIP(value) !== 0`.
   - `exposed` = the host is not `localhost`, `127.0.0.1` or `::1`.
   - `MCP_MIN_ALLOWED_HOSTS`:
     - split on commas, trim, lowercase
     - reject empty entries, and entries containing `://`, `/` or a port (for IPv6, a port after the closing bracket)
     - accept bracketed IPv6
   - Final allowlist = loopback ∪ entries.
   - Errors throw a typed `HttpConfigError` (same pattern as `mcp-min/tools-config-error.js`).
2. `mcp-min/host-validation.js`: Express middleware factory `hostValidation(allowedHostnames)`.
   - **Host:**
     - `req.headers.host` missing → 403 `Missing Host header`.
     - Otherwise take `hostname = new URL('http://' + host).hostname.toLowerCase()`. A parse failure or a hostname not in the allowlist → 403 `Invalid Host: <hostname or raw value>`.
   - **Origin**, only when the header is present:
     - `'null'` or unparseable → 403 `Invalid Origin header: <value>`
     - a hostname not in the allowlist → 403 `Invalid Origin: <hostname>`
   - Body: `{ jsonrpc: '2.0', error: { code: -32000, message }, id: null }`.
   - Before merging, recheck the exact messages against `@modelcontextprotocol/express` 2.0.0 (see repro below) so TASK-15's swap stays invisible to clients.
3. `mcp-min/http-server.js`:
   - `startHttp({ port, host, allowedHostnames })`. Register the logging middleware first (rejections still get logged), then `hostValidation`, then `bodyParser` and the router.
   - Replace `app.listen(port, cb)` with `const server = http.createServer(app); server.listen(port, host)`.
     - `once('listening')` → log `http://<address>:<port>` from `server.address()` (bracket IPv6) and resolve `server`.
     - `once('error')` → log ERROR with code/host/port (plus the "possibly an older pos-cli server" hint for EADDRINUSE) and resolve `null`.
4. `mcp-min/index.js`:
   - Call `readHttpConfig(process.env)` before `startStdio()`, so a malformed config fails before any transport starts.
   - When `exposed`, log the WARN.
   - Pass the config to `startHttp`.
   - Replace the second "HTTP server listening" log with the result-based one (or drop it).
5. `bin/pos-cli-mcp.js`: handle `HttpConfigError` like `ToolsConfigError` (logger message, exit 1, no stack trace). The dynamic import already surfaces errors thrown during startup; ensure `main()` rethrows the typed error instead of `process.exit(1)` with a generic message, or move config reading ahead of the import.
6. Tests, in a new `mcp-min/__tests__/http-exposure.test.js`:
   - Use raw `net` sockets for the missing-Host (HTTP/1.0) case, and `http.request` with an explicit `headers.host` for the others (supertest always sets Host).
   - Cases:
     - default bind: address is `127.0.0.1`; `net.connect` to the first non-internal IPv4 from `os.networkInterfaces()` gets ECONNREFUSED (`test.skipIf` when none)
     - route × {bad Host, missing Host, bad Origin, `Origin: null`} → 403 + exact body
     - `POST /call` for `data-clean` with a bad Origin: spy on the handler and on `resolveAuth` (inject a fake tool registry or `vi.spyOn`), neither called
     - allowed: Host `localhost:<port>`, `127.0.0.1:<port>`, `[::1]:<port>`; Origin `http://localhost:3000`; no Origin
     - `MCP_MIN_HOST=0.0.0.0` with `MCP_MIN_ALLOWED_HOSTS=example.internal`: WARN logged; Host `example.internal:<port>` allowed, `evil.example` rejected
     - malformed config (`MCP_MIN_HOST=not a host`, `MCP_MIN_ALLOWED_HOSTS=http://x`, `a,,b`, `x:5910`) → spawn `bin/pos-cli-mcp.js`, exit ≠ 0, one message, no stdout, no bound port
     - EADDRINUSE: hold port P with `http.createServer().listen(P)` (wildcard); spawn the server with `MCP_MIN_PORT=P`; stderr has the error and no "listening"; an `initialize` sent over stdio is answered
   - Update `http.test.js`, `sse.test.js` and `transport-validation.test.js` only where they construct requests with non-loopback hosts.
7. Docs:
   - docs/SSE_GUIDE.md: remove the "Authentication" section and the Bearer headers from the examples, and state that there is no authentication.
   - mcp-min/README.md: drop the cagent Authorization header.
   - README MCP section and docs/MCP_TOOLS.md: loopback default, `MCP_MIN_HOST`, `MCP_MIN_ALLOWED_HOSTS`, the risk statement.
   - CLAUDE.md MCP Server Pattern: HTTP binds 127.0.0.1 with Host/Origin validation.
   - CHANGELOG security entry, including "restart running pos-cli-mcp processes".
8. Manual DoD check from a second machine or the LAN address.

Repro used when filing:
- **LAN exposure:** `MCP_MIN_PORT=27123 node bin/pos-cli-mcp.js` with stdin held open, then `curl http://$(hostname -I | awk '{print $1}'):27123/health` → `{"status":"ok"}`; `/tools` → tool list; `ss -ltnp` shows `*:27123`.
- **Bind lie:** start two servers with the same `MCP_MIN_PORT`; the second logs "HTTP server listening".
- **Upgrade collision:** `node -e` with an old `http.createServer(()=>'OLD').listen(P)` and a new `.listen(P, '127.0.0.1')` → the new one gets EADDRINUSE; `http.get('http://127.0.0.1:P')` → "OLD".
- **SDK contract probe** (scratch dir: `npm i @modelcontextprotocol/express@2.0.0 @modelcontextprotocol/server@2.0.0 express@5.2.1`): `createMcpExpressApp()` + `app.listen(0, '127.0.0.1')`, raw socket requests:

  | Request | Response |
  |---|---|
  | Host `localhost:port` / `[::1]` | 200 |
  | Host `evil.example` | 403 `Invalid Host: evil.example` |
  | Host `192.168.18.12` | 403 `Invalid Host: 192.168.18.12` |
  | HTTP/1.0 without Host | 403 `Missing Host header` |
  | Origin `http://evil.example` | 403 `Invalid Origin: evil.example` |
  | Origin `http://localhost:3000` | 200 |
  | Origin `null` | 403 `Invalid Origin header: null` |

  Every 403 has body shape `{"jsonrpc":"2.0","error":{"code":-32000,"message":…},"id":null}`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Deviations from the plan, and why
- **`startHttp` rejects on a failed bind.** The plan had it resolve `null`. Instead, `startHttp` resolves only on `listening` and rejects with the listen error. The policy (log and keep stdio) lives in `mcp-min/index.js` `startHttpTransport`, so no caller can mistake `null` for a server, and a direct caller such as a test or TASK-15 sees the real error.
- **The listening log moved to `index.js`.** It is built from `server.address()` (IPv6 bracketed): `mcp-min: HTTP server listening on http://127.0.0.1:<port>`. The old log in `http-server.js` (`HTTP server listening {"port":…}`) is gone.
- **`MCP_MIN_PORT` is validated too** (0–65535, decimal). It was not in the ACs. A non-numeric value reached `server.listen()`, which treats a string as a named-pipe path and creates a socket file in the cwd, so neither the bind nor the log would be honest.
- **A fifth 403 message.** The SDK source (`@modelcontextprotocol/server` 2.0.0 `validateHostHeader`) has a message the description's list omits: `Invalid Host header: <raw>` for a Host that does not parse. It is implemented to keep parity. An `Origin` whose URL has an empty hostname (e.g. `file://`) → `Invalid Origin header: <raw>`, as in the SDK.
- **`MCP_MIN_ALLOWED_HOSTS` normalization.** Entries are normalized with the same WHATWG URL parsing used on request headers (lowercase, punycode, compressed IPv6). The port check runs on the raw entry because `new URL('http://x:80')` drops a default port. The following are rejected:
  - unbracketed IPv6: `::1:5910` is itself a valid address, so host:port would be ambiguous
  - wildcards and any hostname containing characters outside `[a-z0-9._-]`
  - empty entries, which name the whole list in the message
- **`exposed` uses `net.BlockList`.** Any 127.0.0.0/8 address, any spelling of `::1`, IPv4-mapped loopback and `localhost` count as loopback.
- **The exposure warning is logged only after a successful bind.** A failed non-loopback bind exposes nothing.
- **Array check in `hostValidation`.** The factory throws `TypeError` for a non-array allowlist, because a string would turn `includes` into a substring match.
- **Docs beyond the named files.**
  - `docs/API.md` claimed Bearer/x-api-key auth as well; those claims were removed the same way.
  - The rest of the stale content in `docs/SSE_GUIDE.md`, `docs/API.md`, `docs/POS-CLI.md` and `examples/` is left alone and filed as TASK-17: port 3030, `platformos.*` tool names, and the corrupt examples, which do not parse and still send Bearer headers.
- **Three test files instead of one.** Config unit tests, in-process transport tests and spawned-bin startup tests are split so the slow spawn tests run in parallel with the rest.

## Verification
- **Suites.**
  - mcp-min on Node 22.23.2 and 25.6.0: 36 files, 598 tests, all pass (baseline before the change: 33 files, 439).
  - Existing `http`, `sse`, `transport-validation` and `list-envs` tests pass unmodified.
  - The new tests pass 5/5 on repeated runs.
- **Full repo, compared with a clean HEAD worktree.** Both have the same 28 failures, all pre-existing and credential/instance-dependent. Nothing fails only on this branch.
  - Side effect found: `test/unit/generators.test.js` "installs dependencies for custom generator if needed" deletes and reinstalls `test/fixtures/yeoman/custom/node_modules`, and npm rewrites the tracked `package-lock.json`. That was reverted and is not part of this change.
- **The new tests fail against the original code.** With the original `http-server.js`, `index.js` and `bin/pos-cli-mcp.js`: 78 of 92 transport/startup tests fail. The 14 that pass are the accept-path regression guards plus the spy control, which is expected.
- **Mutation check: 29 mutants, all killed:**
  - validation removed / after bodyParser / after router
  - listen without host
  - bind error resolving
  - Origin `null` accepted
  - Host compared with its port
  - Origin judged before Host
  - no array guard
  - missing Host accepted
  - default host `0.0.0.0`
  - everything treated as loopback
  - host:port, wildcard, out-of-range port and empty entries accepted
  - log echoing the config instead of `server.address()`
  - warning never / always / after a failed bind
  - allowlist not passed
  - config read after stdio started
  - bind failure silent / exiting / followed by a "listening" lie
  - bin not catching `HttpConfigError`
  - EADDRINUSE upgrade hint, EADDRNOTAVAIL hint and EACCES host:port dropped
  
  AC3's spy assertions run before the status assertion, so the "validation after router" mutant fails on `handler … called 1 times` rather than on the status code.
- **Manual smoke** (curl, raw sockets): all five 403 messages match the SDK source; each of 8 malformed configs exits 1 with one stderr line and empty stdout.

## DoD (manual, 2026-09-17, Linux, final code)
- **Default server, `MCP_MIN_PORT=27411`.**
  - stderr: `mcp-min: HTTP server listening on http://127.0.0.1:27411`
  - `ss -ltn`: `127.0.0.1:27411` only
  - `curl http://127.0.0.1:27411/health` → `{"status":"ok"}` 200
  - `curl http://192.168.18.12:27411/health` → curl exit 7 (connection refused)
  - Host `192.168.18.12:27411` sent over loopback → 403 `Invalid Host: 192.168.18.12`
- **Real upgrade collision.** A long-running pos-cli 6.5.0 `pos-cli-mcp` on the same machine held `*:5910`. A new server on the default port:
  - logged `HTTP transport not started (EADDRINUSE): 127.0.0.1:5910 is already in use … older pos-cli-mcp …`
  - answered `initialize` over stdio and never logged "listening"
  - meanwhile `127.0.0.1:5910/tools` with `Host: evil.example` was still answered 200 by the old process, which is exactly what the CHANGELOG restart advice addresses.

## Not covered by automated tests
- Windows behaviour for a wildcard holder. The test requires EADDRINUSE on Linux and accepts EADDRINUSE or EACCES elsewhere, and otherwise asserts that 127.0.0.1 reaches the new server if it claims to listen. CI runs windows-latest.
- The privileged-port test skips where port 1 can be bound (root, Windows).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## MCP HTTP transport: loopback-only, Host/Origin-validated, honest about binding

### Why
`pos-cli-mcp` started an unauthenticated HTTP transport on `*:5910` with every MCP client session. Anyone on the LAN could list tools and run `data-clean`, `deploy-start` or `graphql-exec` with the credentials from the server's `.pos`/`MPKIT_*`. A web page could reach it via DNS rebinding. A failed bind was logged as "listening", which would hide the fix during upgrades, when an older server keeps `*:5910` and still answers `127.0.0.1`.

### What changed
- **`mcp-min/http-config.js`** (new): `readHttpConfig(env)` → `{ host, port, allowedHostnames, exposed }`.
  - `MCP_MIN_HOST` defaults to `127.0.0.1` and accepts IP literals or `localhost`.
  - `MCP_MIN_PORT` accepts 0–65535.
  - `MCP_MIN_ALLOWED_HOSTS` entries are normalized like request headers.
  - Malformed values throw `HttpConfigError` (fail closed).
- **`mcp-min/host-validation.js`** (new): `checkHost`/`checkOrigin` and the `hostValidation(allowlist)` middleware. The 403 JSON-RPC body and messages are identical to `@modelcontextprotocol/express` 2.0.0. The allowlist is enforced even on non-loopback binds, where the SDK would skip it.
- **`mcp-min/http-server.js`**:
  - Validation is registered after the request logger and before `bodyParser` and every route.
  - `http.createServer(app).listen(port, host)` resolves on `listening` and rejects with the listen error.
  - The defaults are loopback-only.
- **`mcp-min/index.js`**:
  - Config is read while the module evaluates, before either transport starts.
  - `startHttpTransport` logs the real bound address, or `HTTP transport not started (<code>)` with host:port and a specific hint (older pos-cli-mcp on EADDRINUSE). Stdio keeps serving either way.
  - An exposed bind logs an unauthenticated-exposure WARN on every start.
- **`bin/pos-cli-mcp.js`**: reports `HttpConfigError` like `ToolsConfigError` (one stderr line, exit 1).
- **Docs**:
  - Removed the false Bearer/API-key/rate-limit claims from `docs/SSE_GUIDE.md`, `docs/API.md` and `mcp-min/README.md`.
  - README, `docs/MCP_TOOLS.md`, `mcp-min/README.md` and `docs/SSE_GUIDE.md` document the real protection, `MCP_MIN_HOST`/`MCP_MIN_ALLOWED_HOSTS` and their risk.
  - CLAUDE.md records the three invariants for future changes (TASK-15).
  - CHANGELOG security entry tells users to stop old `pos-cli-mcp` processes, including npx leftovers.

### Behaviour changes for users
- Clients connecting from other machines, or addressing the server by a non-loopback name, now fail. `MCP_MIN_HOST` and `MCP_MIN_ALLOWED_HOSTS` restore that deliberately.
- Browser pages not served from localhost get 403.
- A malformed `MCP_MIN_PORT`, previously treated as a pipe path, now stops startup.

### Tests
- 159 new tests in `http-config.test.js`, `http-exposure.test.js` and `http-startup.test.js`:
  - the route × {bad Host, LAN Host, missing Host, bad Origin, `Origin: null`} matrix, SSE handshake and unknown path included
  - spies proving `data-clean`'s handler and `resolveAuth` never run on rejection (HTTP and JSON-RPC)
  - rejection before body parsing
  - bind address, and LAN refused vs reachable
  - spawned-bin startup: malformed config, EADDRINUSE including a wildcard holder, EADDRNOTAVAIL, EACCES, bound-address log, exposed-mode warning
- Existing tests unchanged.
- Verified: 78 of the transport/startup tests fail on the original code; 29/29 mutants killed.
- Node 22 and 25 green, with no new failures in the full suite compared with clean HEAD.

### Follow-ups
- TASK-17: stale or corrupt MCP docs and examples beyond the security claims.
- TASK-14 and TASK-15 notes updated with the names and contracts this landed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Manually verified that a default server is unreachable from another machine on the network (or via the host's non-loopback address) and reachable via 127.0.0.1, recorded in the PR
<!-- DOD:END -->
