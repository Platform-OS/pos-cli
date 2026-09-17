---
id: TASK-14
title: >-
  pos-cli mcp is documented but never registered: make it start the server, and
  make the server exit on stdin EOF
status: Done
assignee: []
created_date: '2026-09-17 06:29'
updated_date: '2026-09-17 10:40'
labels:
  - bug
  - mcp
  - cli
dependencies: []
references:
  - bin/pos-cli.js
  - bin/pos-cli-mcp.js
  - bin/pos-cli-mcp-config.js
  - mcp-min/index.js
  - mcp-min/stdio-server.js
  - mcp-min/http-server.js
  - lib/program.js
  - lib/assets.js
  - README.md
  - CHANGELOG.md
  - >-
    backlog/tasks/task-6 -
    Extract-a-shared-tools.config-loader-so-pos-cli-mcp-config-and-the-MCP-server-agree.md
documentation:
  - >-
    https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio
modified_files:
  - bin/pos-cli.js
  - bin/pos-cli-mcp.js
  - mcp-min/cli-args.js
  - mcp-min/lifecycle.js
  - mcp-min/stdio-server.js
  - mcp-min/index.js
  - mcp-min/http-server.js
  - mcp-min/__tests__/helpers/server-process.js
  - mcp-min/__tests__/cli-args.test.js
  - mcp-min/__tests__/lifecycle.test.js
  - mcp-min/__tests__/http-shutdown.test.js
  - mcp-min/__tests__/cli-invocation.test.js
  - mcp-min/__tests__/http-startup.test.js
  - README.md
  - docs/MCP_TOOLS.md
  - mcp-min/README.md
  - CLAUDE.md
  - CHANGELOG.md
  - >-
    backlog/tasks/task-6 -
    Extract-a-shared-tools.config-loader-so-pos-cli-mcp-config-and-the-MCP-server-agree.md
priority: high
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every documented way to start the pos-cli MCP server either starts a working stdio server or exits immediately with the correct invocation. No way of starting or stopping it leaves an orphaned server behind.

## Verified behaviour
Checked 2026-09-17 against pos-cli 6.5.0, on Node 22.23.2 / npm 10.9.8 and on Node 25.6.0 / npm 11.8.0.
- README.md:1000 documents `pos-cli mcp` and README.md:1054 documents `pos-cli mcp-config`, and the CHANGELOG announces both. Neither is registered in `bin/pos-cli.js`. Both print `error: unknown command` plus the full help to stderr and exit 1, whether pos-cli is installed globally or run through npx.
- `npx -y @platformos/pos-cli@6.5.0 mcp`: the package has many bins, so npm runs the one named after the unscoped package, `pos-cli`, with the argument `mcp`. It exits 1 after the install (19.3 s cold, about 1 s warm). MCP clients hide stderr, so the server simply never initialises.
- `npx -y -p @platformos/pos-cli@6.5.0 pos-cli-mcp` answers `initialize` in about 1.7 s warm.
- Correction to the report: the subcommand form does not hang, it exits 1. A 120 s "hang" only shows up in a test harness that keeps stdin's write end open and waits on the pipeline instead of the process; that artifact was reproduced while testing. What the user sees is the same either way: a dead server.

## Why registering the command is not enough (prototyped)
Adding `.command('mcp', …)` to `bin/pos-cli.js` does start the server: commander spawns it as an executable subcommand, and `initialize` and `tools/list` pass through. But three problems remain:
1. **It creates real hangs.** `bin/pos-cli-mcp.js` ignores argv, and commander passes arguments through. So `pos-cli help mcp`, `pos-cli mcp --help`, `pos-cli mcp config` (the spelling TASK-6 uses) and `pos-cli mcp --profle dev` all start a server. With stdin at EOF, that server never exits: all four were still running after 4 s.
2. **The server ignores stdin EOF.** The HTTP listener keeps the event loop alive, so after the client closes stdin the process keeps running and keeps its port. MCP 2026-07-28 (stdio): "Servers SHOULD exit promptly when their standard input is closed … This is the primary graceful-shutdown signal and the only portable one."
3. **Wrappers leave the server orphaned.**
   - SIGTERM to `npx` left the `pos-cli-mcp` grandchild alive in 4 of 4 runs on both Node versions, even when stdin was closed first. Testing for this task leaked two such servers, each still holding a port.
   - Commander does forward SIGTERM to its child (verified).
   - SIGKILL to the `pos-cli mcp` parent, or TerminateProcess on Windows, still orphans the child.
   
   Exiting on EOF is what makes every wrapper safe.

Measured cost of the commander wrapper: median time to the first response goes from 1,091 ms to 1,278 ms, plus a 75 MB parent process. That is acceptable to match every other `pos-cli <command>`, including the `lsp` stdio server. `pos-cli-mcp` remains the recommended form, with no wrapper overhead.

## Decisions
- Register `mcp` and `mcp-config` as executable subcommands in `bin/pos-cli.js`, the way `lsp` and `ai` are registered, so both spellings run the same bin with the same argv. Do not run the server in-process: the CLI and the server's argument parser would share the `lib/program.js` commander singleton, and the two spellings could drift apart.
- `bin/pos-cli-mcp.js` parses its arguments before importing `mcp-min/index.js`.
  - `-h/--help` and `-v/--version` print and exit 0.
  - Any unknown option or positional argument fails closed: a stderr message naming the correct invocation, a non-zero exit, and no transport started. `pos-cli mcp config` points the user to `pos-cli mcp-config`.
  - Why fail closed: the tool surface task adds `--profile`, `--include-tools` and `--exclude-tools` to this parser, and a typo there that gets ignored would expose every tool. This is the same reasoning as the fail-closed tools config (CLAUDE.md).
  - Behaviour change: a config that passes stray arguments (ignored today) will no longer start. Record it in the CHANGELOG.
- `bin/pos-cli-mcp-config.js` is equally strict about arguments.
- When stdin reaches EOF after the stdio transport has received at least one message, shut down gracefully:
  - stop reading stdio
  - close the HTTP server, including open SSE connections
  - let in-flight tool calls finish, then exit 0
  - enforce an unref'd hard deadline, so a stuck call cannot keep the process alive
- About that shutdown:
  - The "at least one message" condition keeps HTTP-only use working: `pos-cli-mcp </dev/null`, and the curl flows in docs/MCP_TOOLS.md.
  - The deadline is 120 s, documented, because it must cover the background asset upload that deploy-start fires (`lib/assets.js` `waitForUnpack` polls up to 90 × 1 s).
  - Clients escalate to SIGTERM on their own schedule regardless.
- The direct-run path, `node mcp-min/stdio-server.js [--cwd]`, gets the same EOF rule.
- Docs:
  - Recommend `pos-cli-mcp`, and list `pos-cli mcp` as equivalent.
  - For npx, document `npx -y -p @platformos/pos-cli pos-cli-mcp`, which works with every published version.
  - `npx @platformos/pos-cli mcp` works only from the release that contains this fix; 6.5.0 and earlier cannot be fixed.
- Correct TASK-6 to use `pos-cli mcp-config`.

Out of scope: HTTP binding, Host/Origin validation and bind-failure reporting (TASK-16); protocol conformance (TASK-15); tool selection (TASK-13).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A spawned `bin/pos-cli.js mcp` answers `initialize` and returns the same `tools/list` as `bin/pos-cli-mcp.js`
- [x] #2 `pos-cli mcp-config`, with and without `--json`, prints the same output as `pos-cli-mcp-config`
- [x] #3 `pos-cli mcp --help`, `pos-cli help mcp` and `pos-cli-mcp --help` print usage and exit 0 within 5 s without starting the stdio transport or binding a port; `--version` on both spellings prints the package version and exits 0
- [x] #4 An unknown option or unexpected positional on either spelling (e.g. `pos-cli mcp config`, `pos-cli-mcp --profle dev`) exits non-zero within 5 s, before any transport starts, with a stderr message naming the valid invocation; `pos-cli mcp config` points to `pos-cli mcp-config`
- [x] #5 After a client has sent at least one message and closes stdin, the server exits 0 and releases its HTTP port within 5 s when no call is in flight, on both spellings
- [x] #6 A tool call in flight when stdin closes completes and its response is written before exit; a call that outlives the documented deadline does not keep the process alive
- [x] #7 A server whose stdin is not a client pipe (`/dev/null`, a file or a TTY) keeps serving HTTP when stdin reaches EOF before any stdio message; a client pipe closing ends the server even before any message
- [x] #8 On POSIX, SIGTERM to the `pos-cli mcp` parent terminates the server, and SIGKILL to the parent followed by the client closing its pipe leaves no server process or bound port behind
- [x] #9 Every line written to stdout by a server-starting path is a valid JSON-RPC message
- [x] #10 `node mcp-min/stdio-server.js` shuts down on stdin EOF under the same rule
- [x] #11 README's MCP section documents `pos-cli-mcp` (recommended), `pos-cli mcp`, and `npx -y -p @platformos/pos-cli pos-cli-mcp`, and states that `npx @platformos/pos-cli mcp` requires the fixed release; CHANGELOG records the fix and the strict argument handling; TASK-6 uses `pos-cli mcp-config`
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Related tasks: TASK-13 (tool surface; extends the parser added here), TASK-15 (SDK v2 / 2026-07-28 transport swap; must keep the shutdown behaviour added here), TASK-16 (HTTP bind address, Host/Origin validation and bind-failure reporting in the same http-server.js), TASK-6 (wording fix).

1. `bin/pos-cli.js`: register `.command('mcp', 'start the MCP server (stdio + HTTP)')` and `.command('mcp-config', 'display MCP server tool configuration')`, next to `lsp`.
2. Argument parsing, e.g. a new `mcp-min/cli-args.js` exporting `parseServerArgs(argv)` so it can be unit tested:
   - Use a fresh commander `Command` named `pos-cli-mcp`.
   - `.version(pkg.version, '-v, --version')`, default help option, excess arguments not allowed, no `allowUnknownOption`, `exitOverride` so tests can assert.
   - Errors go to stderr. A positional `config` gets a dedicated message pointing to `pos-cli mcp-config`.
   - `bin/pos-cli-mcp.js` calls it and runs `await import('../mcp-min/index.js')` only after a successful parse. The existing `ToolsConfigError` handling stays.
3. `bin/pos-cli-mcp-config.js`: confirm that commander rejects excess positionals there too; add the same strictness if it does not.
4. Lifecycle, e.g. a new `mcp-min/lifecycle.js`:
   - `markStdioActive()`; `track(promise)` counts in-flight calls; `onStdinEnd({ server, rl, deadlineMs = 120000 })`.
   - `stdio-server.js`: call `markStdioActive()` on the first parsed line, wrap handler invocations in `track()`, and call `onStdinEnd` from `process.stdin` `end`/`close`.
   - `http-server.js`: wrap `/call`, `/call-stream` and JSON-RPC `tools/call` in `track()`. Keep the `http.Server` reference even when listen failed, and ignore `ERR_SERVER_NOT_RUNNING` on close.
   - On shutdown: `rl.close()`, `server.close()`, `server.closeAllConnections()` (for open SSE streams), await in-flight calls, `process.exit(0)`. The deadline timer is `.unref()`'d and makes the deadline injectable for tests.
   - Stdin EOF before any stdio message does nothing (HTTP-only use).
5. The direct-run branch at the bottom of `stdio-server.js` uses the same lifecycle.
6. Tests need the actual bound port (`MCP_MIN_PORT=0`). If TASK-16 has landed, reuse its log of `server.address()`; otherwise log `server.address().port` and let TASK-16 reuse it. Bind-failure handling belongs to TASK-16; do not change it here.
7. Tests in `mcp-min/__tests__/cli-invocation.test.js` (spawn-based, `MCP_MIN_PORT=0`, `MPKIT_*` blanked):
   - both spellings: initialize + tools/list equality
   - `pos-cli mcp-config` vs `pos-cli-mcp-config` output equality
   - help, `help mcp`, version: exit 0, no bound port
   - unknown option or positional: non-zero exit, stderr message
   - EOF with no call in flight: exit 0, port released
   - EOF with a slow fake tool in flight: response written, then exit; deadline respected with a small injected deadline
   - EOF-at-start: HTTP `/health` still answers
   - `describe.skipIf(process.platform === 'win32')` for the SIGTERM parent test and for the SIGKILL parent + pipe-close test (assert no surviving pid via `process.kill(pid, 0)`)
   - every stdout line parses as JSON-RPC
8. Docs: README MCP section (commands, npx form, version note); CHANGELOG (fix + strict argv); CLAUDE.md bin list mentions `pos-cli mcp`; TASK-6 text `pos-cli mcp config` → `pos-cli mcp-config`.
9. Manual DoD check: `npm pack`, then `npx -y ./platformos-pos-cli-<version>.tgz mcp` from an empty dir answers initialize.

Repro used when filing:
- **Dead subcommand:** spawn `npx -y @platformos/pos-cli@6.5.0 mcp` with piped stdio, write an initialize line, wait for the stdout line or the exit event. Result: exit code 1, stderr `error: unknown command 'mcp'`.
- **Hang created by naive registration:** a copy of `bin/pos-cli.js` with `.command('mcp', …)` added, run as `timeout 4 node bin/pos-cli.js help mcp </dev/null`. Result: 124 (still running); same for `mcp --help`, `mcp config`, `mcp --profle dev`.
- **EOF ignored:** spawn `bin/pos-cli-mcp.js`, send initialize, `stdin.end()`, wait 2.5 s. `ss -ltnp` still lists the port.
- **Orphan under npx:** spawn `npx -y -p @platformos/pos-cli@6.5.0 pos-cli-mcp`, wait for the initialize response, `kill('SIGTERM')` the npx pid, wait 3 s. `ps -eo pid=,args=` still lists `node …/_npx/…/pos-cli-mcp` (1 survivor per run, 4/4 runs, Node 22 and 25).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-16 implementation (2026-09-17) changes two facts this plan relies on:
- `startHttp({ port, host, allowedHostnames })` resolves only on `listening` and **rejects** with the listen error. No `http.Server` exists after a failed bind, so plan step 5's "keep the http.Server reference even when listen failed / ignore ERR_SERVER_NOT_RUNNING" reduces to: close the server only if `startHttpTransport` (mcp-min/index.js) got one. Keep a module-level reference there.
- The bound-address log line is `mcp-min: HTTP server listening on http://<address>:<port>`, taken from `server.address()` (IPv6 bracketed). On failure the line is `mcp-min: HTTP transport not started (<code>): …`, and stdio keeps running. `mcp-min/__tests__/http-startup.test.js` already has spawn/`waitFor`/`initializeOverStdio` helpers that parse both lines, and uses `MCP_MIN_PORT=0`. Reuse them for the stdin-EOF tests instead of writing new ones.
- Invalid `MCP_MIN_HOST`, `MCP_MIN_PORT` or `MCP_MIN_ALLOWED_HOSTS` now throws `HttpConfigError` while `mcp-min/index.js` evaluates. `bin/pos-cli-mcp.js` reports it through `CONFIG_ERRORS`. If this task moves argument parsing into the bin, keep config errors reported before any transport starts.

## Implementation (2026-09-17): deviations from the plan, and why
- **AC #7's stdin rule was refined** (AC text updated).
  - The planned rule, "EOF ends the session only after at least one message", leaves an orphan whenever a client starts the server and closes the pipe before sending anything, holding the port forever. That contradicts the outcome.
  - Implemented rule (`stdinEndEndsSession`, `mcp-min/lifecycle.js`): EOF ends the session when stdin is a client pipe or socket (`!isTTY && instanceof net.Socket`: POSIX pipes, Windows named pipes, sockets), or once any message has been received.
  - `/dev/null` (`NUL`), a file or a TTY with no messages keeps HTTP serving: `pos-cli-mcp </dev/null`, containers without `-i`, CI background jobs.
- **No `track()` instrumentation; shutdown is a drain.** Transports stop taking work, the process exits naturally, and an unref'd 120 s deadline forces exit 0. Exiting right after the handlers resolve would cut off background tool work: `deploy-start` fires `deployAssets` and returns, and the upload plus `waitForUnpack` take up to ~90 s. The drain also leaves the five dispatch paths that TASK-5 and TASK-15 touch unchanged. Verified that undici's fetch pool does not hold the process (natural exit 24 ms after a fetch).
- **No shutdown-deadline env var.** The deadline is the constant `SHUTDOWN_DEADLINE_MS`. Tests inject a short one through `createShutdown({ deadlineMs })` in an inline stdio server.
- **New `stopHttp(server)`.**
  - A prototype showed `server.close()` alone leaves an in-flight keep-alive connection idling for the 5 s keep-alive timeout after its response (exit came 6 s later).
  - So while closing, every response finish triggers `closeIdleConnections()`, and new responses get `Connection: close`.
  - SSE streams (`GET /`, `POST /call-stream`) are tracked and destroyed.
  - Per-server state lives in a WeakMap, and the call is idempotent.
- **Readline moved into `startStdio()`.** It used to be created at import, so stdin was read before the close listener existed. That becomes a race if any module ever uses top-level await.
- **`--help` / `--version` set `process.exitCode`** instead of calling `process.exit()`: stdout to a pipe is asynchronous on macOS and Windows.
  - `pos-cli mcp -v` is answered by `pos-cli`'s own version option with the same package version (verified).
  - `pos-cli-mcp-config` was already strict (commander 15); only tests were added.
- **Test helpers.** Helpers were extracted to `mcp-min/__tests__/helpers/server-process.js`, and `http-startup.test.js` now uses them, as TASK-16's note suggested.

## Known limitation (covered by TASK-15 AC #6)
A polling `streamHandler` (`mcp-min/logs/stream.js`, currently not registered) keeps polling after its client disconnects, because handlers get no cancellation signal. It would hold a shutdown until the 120 s deadline.

## Compatibility (filed as TASK-15 AC #15)
The strict parser means a release that writes `--no-http` into shared project MCP configs must not follow a release that has only this parser. Release them together, or teach this parser `--no-http` first.

## Verification
- **Probed before implementing.**
  - commander 15 executable-subcommand argv passing (`help mcp` becomes `--help`; the parent answers `-v`) and its strictness
  - `http.Server.close()` with in-flight keep-alive and SSE, on Node 22 and 25
  - undici exit behaviour
  - Node destroys `child.stdin` when the child exits, which is why the SIGKILL-orphan test uses a Unix socket pair as stdin
- **Tests: 62 new.**
  - `lifecycle.test.js` (10), `cli-args.test.js` (15), `http-shutdown.test.js` (6), `cli-invocation.test.js` (31, spawned processes)
  - mcp-min is 40 files, 660 tests, green on Node 22.23.2 and 25.6.0
  - spawn suites 5/5 stable on repeat, with no leaked processes
- **Full repo.** The same 28 pre-existing failures as clean HEAD, and zero new ones; all 221 tests added by TASK-16 and TASK-14 pass. `test/unit/generators.test.js` rewrites `test/fixtures/yeoman/custom/package-lock.json` on each full run; that file was reverted and is not part of this change.
- **Against the pre-TASK-14 server** (TASK-16 state of `bin/pos-cli-mcp.js`, `index.js`, `http-server.js`; HEAD `bin/pos-cli.js`, `stdio-server.js`), 31 of 37 transport tests fail. The 6 that pass are expected:
  - `pos-cli mcp --version` / `-v`, answered by the parent
  - `pos-cli-mcp-config --jsn`, already strict
  - direct-run `stdio-server.js` EOF (x2), which has no HTTP listener
  - `stopHttp refuses a server it did not start`, which passed vacuously. It now asserts the exact message and fails on the old code.
- **Mutation check: 25 mutants, all killed:**
  - mcp / mcp-config unregistered
  - bin ignoring the parse result
  - excess arguments / unknown options allowed; config hint dropped; errors exiting 0
  - stdin close ignored
  - pipe rule dropped / every EOF ends the session / TTY counted as a pipe
  - deadline not unref'd; closers not run; late closer dropped; closer error aborting the rest; deadline exit 1
  - no drain after response finish; streams not destroyed; call-stream or GET / stream untracked
  - HTTP not stopped; stdio given its own shutdown
  - messages not counted
  - default deadline 30 s
  - `server.close` skipped
  
  The mutant `process.exit()` instead of `exitCode` was not run: Linux pipes are synchronous, so the truncation it guards against cannot be observed here.

## DoD (manual, 2026-09-17, Linux, npm 11.8.0)
- **Setup.** `npm pack` → `platformos-pos-cli-6.5.0.tgz` (contains the new `mcp-min` modules and both bins, no `__tests__`).
- **Run.** From an empty directory, `npx -y ./platformos-pos-cli-6.5.0.tgz mcp` with `MCP_MIN_PORT=0`.
  - Process tree: `npm exec ./platformos-pos-cli-6.5.0.tgz mcp` → `node …/_npx/…/.bin/pos-cli mcp` → `node …/@platformos/pos-cli/bin/pos-cli-mcp.js`.
  - `initialize` was answered after 25.5 s, mostly the cold install.
- **Shutdown.** Closing stdin gave `npx` exit 0 after 146 ms, and none of the three processes survived.
  - stderr: `stdin closed by the MCP client; shutting down…` then `HTTP server on http://127.0.0.1:38649 closed`.
  - The npx cache entry this created was removed afterwards.
- **Gotcha.** `npx -y /absolute/path.tgz mcp` does not install the tarball: npx executes the path itself (`Permission denied`, exit 126). The DoD's `./file.tgz` form is the one that installs it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## `pos-cli mcp` works, and the MCP server ends when its client does

### Why
- **Dead documented commands.** `pos-cli mcp` and `pos-cli mcp-config` were documented but never registered (`unknown command`), so `npx -y @platformos/pos-cli mcp` gave MCP clients a server that never started.
- **Registering them was not enough.** The server ignored its arguments (`pos-cli mcp --help` would start a server that never exited) and ignored stdin EOF (the HTTP listener kept servers alive after their client left: one held port 5910 for 8 days, and `npx`-launched servers outlived their client).

### What changed
- **`bin/pos-cli.js`**: registers `mcp` and `mcp-config` as executable subcommands.
- **`mcp-min/cli-args.js`** (new) + **`bin/pos-cli-mcp.js`**: arguments are parsed before the server is imported.
  - `--help` / `--version` print and exit 0 without starting anything.
  - Any other argument exits 1 with a message, and `pos-cli mcp config` points to `pos-cli mcp-config`. This is fail-closed for TASK-13's options.
- **`mcp-min/lifecycle.js`** (new):
  - the stdin EOF rule: a client pipe, or any message received, ends the session
  - `createShutdown`: shared closers, late closers run at once, unref'd 120 s deadline
- **`mcp-min/stdio-server.js`**: readline is created in `startStdio({ shutdown })`; messages are counted and the rule is applied on close.
- **`mcp-min/http-server.js`**: `stopHttp()` stops accepting, destroys SSE streams, lets in-flight responses finish and closes their keep-alive connections at once.
- **`mcp-min/index.js`**: one shutdown shared by both transports; an HTTP bind that completes after EOF is stopped immediately.
- **Shutdown is a drain.** Responses are written and background tool work (deploy-start's asset upload) finishes; then the process exits by itself.
- **Docs.** README (recommended `pos-cli-mcp`, `npx -y -p` form, `npx … mcp` needs this release, lifetime, `</dev/null` / `NUL`, strict args); `docs/MCP_TOOLS.md`; `mcp-min/README.md`; CLAUDE.md invariants; CHANGELOG (fix, strict-args behaviour change, stdin shutdown); TASK-6 reworded to `pos-cli mcp-config`.

### Behaviour changes
- Client configs passing stray arguments to `pos-cli-mcp` now fail to start.
- A server whose client closes stdin exits after in-flight work (at most 120 s). HTTP-only use needs stdin from `/dev/null`.

### Tests
- 62 new tests; mcp-min 660/660 on Node 22 and 25.
- The full repo has no new failures compared with clean HEAD.
- 31 of 37 transport tests fail against the pre-TASK-14 server (the 6 passes are expected); 25/25 mutants killed.
- DoD: `npx -y ./<tarball> mcp` answers `initialize`, and the npx → pos-cli → server tree exits 0 within 146 ms of stdin closing.

### Follow-ups
- TASK-15 AC #6: stream-handler cancellation.
- TASK-15 AC #15: ship `--no-http` together with, or after teaching, this strict parser.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Manually verified on the npx bin-selection path: an `npm pack` tarball started as `npx -y ./<tarball> mcp` answers `initialize`, recorded in the PR
<!-- DOD:END -->
