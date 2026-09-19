# Changelog

## Unreleased

### New Features

* **`deploy-dry-run`: what a deploy would change, before it changes it.** A deploy that is not partial is the whole intended state of the instance — every file missing from the build is deleted there — and over MCP the only way to find that out was to do it. The new tool builds the release, uploads it with `dry_run`, and reports which files would be added, updated and deleted, applying nothing; assets are covered too, since the manifest is validated against the dry-run release without anything reaching S3. `deleted`, `upserted` and `skipped` are totals an agent can branch on, with the per-category breakdown beside them. It is a separate tool rather than a `dryRun` flag on `deploy-start` so that no argument can turn it into a deploy, and so the two can carry different annotations: `deploy-start` stays `destructiveHint: true`, which a client may gate behind a prompt, while the dry run states `destructiveHint: false` — and deliberately not `readOnlyHint`, because it does record a release and write an archive. It joins `--profile dev`: without it, an agent in that profile has `deploy-start` and no way to see the blast radius first.

* **pos-cli ships a Claude Code plugin that registers its language server.** `plugin/.claude-plugin/marketplace.json` declares `pos-cli-lsp` for `.liquid` and `.graphql`, which is the only way Claude Code accepts language-server configuration — it reads no `lsp` key from `settings.json` and no project-level LSP file, which is what the README used to tell you to write. `pos-cli ai init` prints the two commands that register it — `claude plugin marketplace add <pos-cli>/plugin` and `claude plugin install platformos-lsp@platformos` — and stays quiet when it is already registered. It prints rather than runs them, because installing a plugin is a real install that writing a JSON file cannot stand in for, and because `ai init` should not start depending on the `claude` binary. Add `--scope user` to both for every project on the machine. A second, optional plugin — `platformos-lsp-reminders` — prints one line after a Liquid or GraphQL edit noting that diagnostics have to be asked for; it runs no linter, because `pos-cli check run` is whole-project only and takes about a minute on a large app, and a throwaway language server costs about four seconds per edit, both paid on every write. A language server runs out of process, so unlike an MCP tool it adds nothing to what the model reads on every request. The README's supported-file list no longer claims `.json`: the server answers nothing for a JSON file, and mapping it would make pos-cli the language server for every `package.json` in the project.

* **One `job-status` tool for every asynchronous operation.** `deploy-start`, `data-import`, `data-export`, `data-clean` and `tests-run-async` now return a `job_id` beside their usual fields, and `job-status` reads any of them back: `state` is `running`, `completed` (the operation finished — a test run whose assertions failed is `completed`, because the run did its work) or `failed` (the operation itself failed), with `done` derived from it. `wait_ms` (up to 120 s, and cancellable) waits for the job instead of polling; reaching the deadline returns the current state with `done: false` rather than an error. The six per-operation status tools it replaces — `deploy-status`, `deploy-wait`, `data-import-status`, `data-export-status`, `data-clean-status`, `tests-run-async-result` — are **removed** (see Removals).

  The `job_id` is opaque and must be passed back unchanged. It carries the kind of job, the id the instance gave it, the instance it was started on and the flags that kind needs to read a status — not a key into the server's memory, because MCP clients restart stdio servers while the agent keeps its conversation, and a table would turn every restart into "unknown job". It is parsed strictly on the way back in, and nothing in it decides which credentials are used or which host is called.

* The MCP server speaks protocol revision **2026-07-28**, and still serves clients on the 2025 revisions. Its protocol layer is now the MCP TypeScript SDK v2 (`@modelcontextprotocol/server`), which answers each client in its own revision from one definition: a client opening with `server/discover` gets 2026-07-28 (with the per-request `_meta` envelope, `resultType` and the version-negotiation errors the revision defines), one opening with `initialize` gets `2025-11-25`, `2025-06-18` or `2024-11-05` as before. The tools themselves are unchanged, and so is the JSON they return. Verified against the official MCP clients — v2 in both eras and v1 — over stdio and HTTP, and with MCP Inspector.

* **MCP over HTTP is served at `/mcp`** (MCP Streamable HTTP): 2026-07-28 requests, and 2025-era clients statelessly. `GET` and `DELETE` there answer `405`, a body over 1 MB `413`, and a body that is not JSON `415`; a request whose headers and body disagree is refused with `-32020`, and an unsupported revision with `-32022`. The HTTP transport's loopback bind, `Host`/`Origin` validation and bind-failure reporting apply to it unchanged.

* **Tool failures reach the model as tool results.** Arguments that do not match a tool's schema (`INVALID_PARAMS`), a tool reporting `{ok:false}` (its own code) and a tool that throws (`INTERNAL_ERROR`) now come back as results marked `isError` with a JSON body carrying the code and message — what the 2026-07-28 tools specification asks for, and what lets a model correct itself instead of seeing a transport failure. A tool that does not exist, or is not exposed, is still a protocol error. Over stdio, argument failures used to be `-32602`.

* **Cancelling a call stops the work.** A client cancelling a call (`notifications/cancelled`, or closing the HTTP response) aborts the tool's `ctx.signal`: `deploy-wait` stops polling the instance and `logs-fetch` stops paging, instead of running on for a client that is no longer listening. Nothing is sent for a cancelled call.

* **`--no-http`** starts the server without an HTTP listener, serving MCP over stdio only, and does not read `MCP_MIN_*` at all. `pos-cli ai init` now writes it (`--profile dev --no-http`), and upgrades an entry an earlier release wrote. Editors start one server per session; none of them used the listener, and every session after the first logged `HTTP transport not started (EADDRINUSE)` while the first session's credentials served every HTTP caller. **Re-run `pos-cli ai init` to pick this up.**

* Tools that only read — `envs-list`, `logs-fetch`, `job-status`, `data-validate`, `constants-list`, `generators-list`, `generators-help`, `migrations-list` and the Partner Portal lookups — carry `annotations.readOnlyHint`, which clients may use to run them without asking. Everything else is unmarked, which means "may change things".

* The MCP server can expose a subset of its tools. Every tool definition is sent to the model with each request, and the full set is about 24.6 KB of JSON before any work is done. `pos-cli-mcp --profile dev` exposes the nine tools a coding agent uses to edit, check, deploy and verify (`check-run`, `logs-fetch`, `liquid-exec`, `graphql-exec`, `envs-list`, `deploy-start`, `job-status`, `unit-tests-run`, `tests-run-async`), about a quarter of the size. `--include-tools a,b` adds tools to the profile and `--exclude-tools a,b` removes them; both take comma-separated names and can be repeated. `--include-tools` is not an allowlist, unlike Gemini CLI's `includeTools` setting — `--profile none --include-tools a,b` is. The selection is fixed at startup and the same on stdio and HTTP for every client, and a tool that is not exposed cannot be called on any transport. A selection that is not exactly what it looks like stops the server with one message before either transport starts: an unknown profile or tool name (close matches are suggested), a tool named in both options, `--include-tools` naming a tool that `tools.config.json` disables, or a selection that leaves nothing. `pos-cli-mcp` with no options exposes every tool, as before; the default is planned to become `dev` in the next major release. A project MCP configuration that passes these options to pos-cli 6.5.1 or earlier gets every tool there, because those releases ignore their arguments.

* **The pos-cli MCP server is registered as `platformos-cli`**, not `platformos`. The old name said nothing about which server it was — the supervisor is platformOS too — and this one is named after the command it runs. `pos-cli ai init` renames an entry it wrote earlier, in place, so the rest of the file keeps its order, and removes the old entry rather than adding a second one: two entries for the same server start it twice and show the agent every tool twice. An entry you have customised stays under the old name, untouched, with a message naming the new one — the name is only how your AI tool refers to the server, so nothing breaks if you keep it. **Re-run `pos-cli ai init` to pick this up**, or rename the key yourself.

* `pos-cli ai init` registers the pos-cli server with `--profile dev`. Re-running it upgrades an entry that an earlier release wrote (`"command": "pos-cli-mcp"` with no arguments), and **no longer overwrites an entry you have changed**: a `platformos-cli` or `platformos-supervisor` entry that differs from what it would write — another profile, extra environment variables, a different command — is kept exactly as it is, and the command prints what it would have written so you can merge it by hand. It used to replace any entry that differed.

* `pos-cli mcp-config` takes `--profile`, `--include-tools` and `--exclude-tools` and shows exactly what the server would expose with them — the same code resolves both — together with the reason each other tool is not exposed (not in the profile, excluded, or disabled in the tools config). It refuses the same selections and configuration files the server refuses, with the same message. **Behaviour change:** `--json` prints that report (`config`, `profile`, `include`, `exclude`, `exposed`, `hidden`) instead of the raw contents of the configuration file.


* **The MCP server tells the client how to use it.** It now returns the protocol's `instructions` string on `initialize` and on `server/discover`, which clients place in front of the model once a session. It carries only what no single tool can say for itself: how credentials resolve and that a call without `env` lands on whichever `.pos` entry is first; that every tool answers with `ok`, and reports failure as `ok:false` inside the result rather than as a failed call, so a client that only checks whether the call succeeded misreads it; that a relative path resolves against the directory the server was started in; and that an operation returning a `job_id` is waited on with `job-status` and `wait_ms` rather than a polling loop. It is composed from the tools the server actually exposes, so `--profile dev` is told about `deploy-start` and `tests-run-async` and nothing about `data-clean`, and `--include-tools`/`--exclude-tools` move it with them — a server of local tools alone is told nothing about credentials at all. It never names a tool from another MCP server, since what else a client has registered is not knowable here. `pos-cli mcp-config` prints the exact string a selection produces, in its report and in `--json`.

### Removals

* **The six per-operation status tools are removed**: `deploy-status`, `deploy-wait`, `data-import-status`, `data-export-status`, `data-clean-status` and `tests-run-async-result`. `job-status` reads back every one of the operations they covered, from the same adapters they used, so nothing they could report is lost — and two of them reported less than the truth: `deploy-status` answers about the release and ignores the asset phase, and `deploy-wait` returns as soon as the release settles, so a deploy still uploading assets read as finished on both. They cost 3,495 bytes of every `tools/list`, 16% of what a bare server sent, for tools whose own descriptions told the model to use something else; exposing them beside their replacement asked a model to choose on every status check, and the wrong choice was silent. `--profile dev`, which `pos-cli ai init` writes, never included them. A `tools.config.json` that still names one is warned about and ignored rather than refusing to start — the same tombstone mechanism `check` uses — but `--include-tools` and `--exclude-tools` fail closed on unknown names, so a launch command naming one has to be updated.

* **`mcp-min/logs/stream.js` is deleted.** It was a complete tool module that the registry never referenced, so it was never listed and never callable. Registering it was not an option: it implements `streamHandler`, the pre-SDK interface the deprecated `/call-stream` route uses and the SDK dispatch path cannot call; it returns a promise that never resolves; and it polls on a timer chain with no cancellation check, which would hold every shutdown until the 120 s deadline. No registered tool has a `streamHandler`, so `POST /call-stream` answers `tool has no streamHandler` for every tool a client can name, and goes at the next major with the rest of the pre-SDK routes.

* **Breaking, for anything reading a tool result directly.** Every tool now answers `{ ok: true, data, meta }` or `{ ok: false, error: { kind, code, message, details? }, meta }`. The payload is always under `data`: `graphql-exec` and `liquid-exec` used to return theirs under `result`, `deploy-start` returned `archive` and `assets` beside `data`, `unit-tests-run` returned `raw`, and five tools returned it at the top level under no key. `meta` is built by the server, so `meta.auth` is now present and identical everywhere a tool resolved credentials, and a tool's own extra `meta` fields are gone. MCP clients are unaffected in practice — the body is read by a model — but the deprecated `POST /call` and JSON-RPC routes hand back the raw result, so a script parsing those needs the new shape. Those routes also stop reporting a tool's own failure as an HTTP 500 with a stringified error: it comes back 200 with the tool's `ok: false` and its code, which is what it always should have been.

  `data-validate` changes with it: records that fail validation are now a successful call reporting what is wrong, not a failed one. It is a check, and it did what was asked — the same reading `check-run` has always had for lint violations and `unit-tests-run` has for failing assertions. Only a failure of the checker itself is `ok: false`.


* **`TOOLS.md`, `DEPLOY.md`, `docs/API.md`, `docs/POS-CLI.md`, `docs/SSE_GUIDE.md`, `examples/mcp-client.js` and `examples/python-client.py` are deleted**, and `CONTRIBUTING.md`'s MCP, code-standard and testing sections are rewritten against what the repository actually contains — they told a contributor to create `src/tools/new.tools.ts`, register it in `src/tools/index.ts`, write Zod schemas and keep TypeScript strict, in a repository with no TypeScript. `DEPLOY.md` described running the server in Docker behind nginx with an `ADMIN_API_KEY` and a `clients.json`; `TOOLS.md` documented eleven tools under names the server has never used. The rest described an MCP server that was never built: base URL `localhost:3030` (the server listens on 5910), `npm run mcp`, a `clients.json` of client secrets and an `x-api-key` admin header (there is no authentication), Zod validation (it is Ajv), `lib/apiWrappers.ts` and `src/types/index.ts` (no such files), and tools named `platformos.logs.stream`, `platformos.env.list` or `platformos.graphql.execute` — none of which the server registers. Neither example parsed: both ended mid-file in a stray JSON fragment. `docs/MCP_TOOLS.md`, the README's MCP section and `mcp-min/README.md` document what actually ships; none of these files were part of the npm package.

* **`mcp-min/package.json` and `mcp-min/package-lock.json` are deleted.** `mcp-min` is a directory of pos-cli, not a package: it is imported from the root, its dependencies (`express`, `body-parser`) are declared and installed at the root at the same versions, and nothing ever installed the subpackage — there was no `mcp-min/node_modules`. The nested manifest only shipped a second, never-resolved dependency list inside the published tarball, and it would have silently broken any `#lib/*` import written under `mcp-min/` (subpath imports resolve against the nearest package.json). `"type": "module"` there was redundant: the root package already declares it. Its `npm start` script had stopped working when the server moved to `start({ selection })`, and the documents that told you to run `cd mcp-min && npm start` now say `pos-cli-mcp`.

* **The `mcp/` directory and `jest.config.mcp-min.json` are deleted.** `mcp/` held a Jest setup file and four CommonJS test files that `require` modules which do not exist (`../storage`, `../server`, `../auth`, `../proxy-wrapper`) — the test half of the same never-built server, left behind when the MCP work landed. Nothing ran them: this repository's runner is vitest, which collects `test/**` and `mcp-min/__tests__/**`, and Jest is not a dependency. The stale config pointed Jest at `mcp-min/**/__tests__` with a coverage threshold it never enforced.

* **Invoking a tool over stdio by naming it as the JSON-RPC method** (`{"jsonrpc":"2.0","method":"envs-list"}`) is gone; it was never part of MCP and is answered as an unknown method. Use `tools/call`.

* A stdio line that is not valid JSON is now ignored rather than answered with `-32700`, and `initialize` without `clientInfo` — which every MCP revision requires — is refused. No MCP client is affected by either.

* **The `check` MCP tool is removed.** It duplicated `check-run`, was switched off by default, and could not run: it shelled out to a `platformos-check` executable that a pos-cli install does not provide. `check-run` runs the same linter in-process and is in the `dev` profile. See Security for the other reason it is gone. A tools config of your own that still configures `check` keeps working — the server warns that the tool no longer exists and ignores the entry, rather than refusing to start over a line you could not have removed before upgrading.

* **`data-validate` no longer accepts `env`.** The parameter reached one debug line and nothing else — the check reads the schema files in the project and sends nothing to an instance — so all it could do was suggest the validation was instance-aware. A call that passes it is now rejected rather than silently ignoring it.

### Fixes

* **`pos-cli logsv2 search` did not work at all, and said so in a way that blamed the instance.** `lib/swagger-client.js` built its query by assigning to an undeclared `query` — an implicit global, which CommonJS tolerates and an ES module does not. Every search had thrown `ReferenceError: query is not defined` since the ESM migration released in 6.0.0, and the command's own `catch` printed it as though the search had been refused. `logsv2 reports` and `logsv2 searchAround` were unaffected: neither goes through that function. Each search now also builds its own query object rather than sharing one, so two searches cannot overwrite each other.

* **A failed migration used to reach the client as a successful call.** `migrations-list`, `migrations-run` and `migrations-generate` answered `{ status: 'ok' | 'error' }`, and the protocol layer decides a call failed by reading `ok === false`. `undefined` is not `false`, so a migration that did not run — a rejected token, an unreachable instance, a migration the instance refused — was delivered as an ordinary successful result with the error buried in the body. An agent that ran a migration and checked whether the call failed was told it worked. `generators-list` was the fourth of its kind: it answered with no success field at all and turned a generator it could not read into one with no arguments.

  Rather than making those four match the other thirty-one, the envelope stopped being a convention. A tool now returns the data it produced, or throws; `ok`, the error body and `meta` are built in one place for every transport, and a handler that still returns an envelope is rejected rather than wrapped in a second one. The four had drifted for a release without anyone noticing, and the tools had no behavioural test to notice with — they have one now.

* **Every failure says what to do about it.** An error carries a `kind` beside its `code`: `input` (fix the arguments), `not_found`, `auth` (re-authenticate rather than retry), `project` (the working tree is not ready), `instance` (the instance ran it and refused), `unavailable` (nothing was decided; the same call may work later), `internal` (a pos-cli defect) and `cancelled`. Around twenty codes that named nothing but the tool they came from — `DEPLOY_START_ERROR`, `MIGRATIONS_LIST_ERROR`, `CONSTANTS_SET_FAILED` — are gone; each of them had covered a rejected token, an unreachable instance and a bug in pos-cli under one string. What a thrown error means is now judged once, from the status and network code it carries, instead of in thirty-five catch blocks. Credential failures classify themselves too: an environment that is not in `.pos` is `not_found` with `ENV_NOT_FOUND`, not a generic failure.

  Every failure, including the ones decided before a handler runs: arguments that do not match the schema come back as `kind: "input"` with `INVALID_PARAMS`, which was the one result that arrived without a kind while the server instructions promised one on all of them. The status-to-kind judgement is a single table, so the tools that read a status off a response rather than catching a throw — the `/_tests/*` runners, `sync-file`, `uploads-push` — reach the same answer as the invoker. `uploads-push` used to call every failure `unavailable`, which told an agent holding an expired token to try again later.


* **A schema now declares the default its handler applies.** Twelve parameters — `strictTypes`, `strictProperties`, `appPath`, `validate`, `maxErrors`, `dryRun`, `confirmDelete`, `lastId` and `timeout_seconds` among them — had a default in the code and nothing in the published schema, so a model reading `tools/list` saw `strictTypes` and had no way to know it was on. The descriptions had said so in prose until the rewrite removed it, correctly: prose goes stale and the schema does not. `env-add`'s `timeout_seconds` also publishes the 120-second ceiling the handler had been silently clamping to, and three parameters that carried no description at all — `logs-fetch`'s `limit`, `deploy-wait`'s `intervalMs`, `constants-set`'s `value` — have one. A test now fails on a parameter with no description.

* **`liquid-exec` reported a successful render as a failure whenever the output contained the word "error".** It looked for `error` anywhere in the rendered string, so a page about error handling, or a template rendering "there was no error", came back as `ok: false` with its own output as the error message. It now looks for the marker a real failure renders, `Liquid error`, anywhere in the output — which still catches a template that fails after partly rendering.

* **`partners-list` no longer takes `partner_id`.** With it, the tool fetched that one partner from the same endpoint `partner-get` uses and returned a thinner version of the same record — two tools answering one question, with nothing in either description to say which to call. A model had to choose on every lookup and either choice was defensible, which is the failure mode. `partners-list` lists; `partner-get` fetches one, with the fuller record. A call that still sends `partner_id` is rejected rather than quietly listing everything.

* **The plain logger backend bound `console` at import time.** `lib/logger/simple.js` — the one used when `NO_COLOR` or `CI` is set — assigned `const Info = console.log`, capturing whatever that was the moment the module loaded, so anything replacing `console` afterwards was bypassed. `rainbow.js` calls through a closure and does not have the problem. The output was always the same and on the same stream; what differed was whether anything else could observe it, which made the two backends behave differently under a test spy or a log collector. Both now call through when they run.

* **The MCP server no longer writes to stdout, which is its protocol channel.** `logger.Info`, `Success`, `Log`, `News` and `Print` all print to stdout, and two of them are reachable from inside a tool call: a Partner Portal retry notice (`lib/proxy.js`) and a two-factor session message (`lib/twoFactorSession.js`). Either one arriving mid-response put non-JSON bytes into the stdio transport and the client saw a malformed message. In server mode those five now write to stderr, where MCP clients collect a server's output; the command line is unchanged.

* **`deploy-start` no longer uploads an empty archive.** The "no files to deploy" check ran *after* the upload, so a project that produced an empty archive — everything ignored, a misconfigured `.posignore` — created a release from it and only then reported `EMPTY_ARCHIVE`. A release that is not partial is the whole intended state of the instance, so that asked the instance to delete every file it had. `pos-cli deploy` has always skipped the upload in that case; the MCP tool now does too, before anything is sent.

* **An uncaught exception stops the server instead of leaving it running.** It was logged and ignored, so a process whose state Node considers undefined carried on serving every tool with this machine's credentials, on an unauthenticated port. It now drains the way a client disconnect does — responses in flight are written, the transports stop, the port is released — and exits non-zero.

* **A request body that grows past the 1 MB limit while it is still arriving is answered with `413`.** Reading it with `for await` destroyed the request on overflow, taking the socket the answer had to be written to with it, so a chunked upload got a reset connection instead — and only sometimes, depending on how the body was split.

* **Explicit credentials are all-or-nothing, and an environment with nothing in it is an error.** Passing `url` and `token` without `email` fell through to `.pos` resolution, so the call went to an instance the caller had not named. A `.pos` entry with no `url`/`token` resolved as if it were credentials, and the instance answered `401`. Both now fail with a message saying what is missing.

* **An MCP tool told which environment to use now uses it.** `resolveAuth` resolved a named `.pos` environment through the CLI's `fetchSettings`, which answers from `MPKIT_URL`/`MPKIT_EMAIL`/`MPKIT_TOKEN` before it reads `.pos` — so on a machine with those variables exported (a shell used for CLI work, a CI runner, an editor that inherits the shell), `{ "env": "production" }` reached whatever they pointed at, and the result still reported `source: ".pos(production)"`. An environment name that was not in `.pos` resolved too, instead of raising the "not found" error. Every write tool is on that path: `deploy-start`, `data-import`, `data-clean`, `constants-set`, `uploads-push`, `sync-file`. The MCP server now reads a named environment from `.pos` and nowhere else, and an unknown name is an error. **The CLI is deliberately unchanged** — `pos-cli deploy staging` with `MPKIT_*` set still uses `MPKIT_*`, which is what CI relies on — and a test pins each resolver's order. An environment name that is a property of `Object.prototype` (`constructor`, `toString`) no longer resolves to anything, in either resolver.

* **An MCP deploy is no longer reported as finished while it is still deploying.** Three separate ways it could be:
  * `deploy-wait` returned success on `in_progress`. It kept polling only on `ready_for_import`, but the API also answers `in_progress` while the release is being imported (`pos-cli deploy` polls on both), so a wait that started early returned `ok: true` mid-deploy. Both it and `job-status` now wait for the release to settle.
  * Assets were never reported at all. `deploy-start` uploads them in the background and used to send the manifest without the release id, so the instance never associated the two and `asset_status` / `asset_report` stayed empty — an agent had nothing to tell it that a deploy's assets were still going up. The manifest now names the release (as `pos-cli deploy` does, once the release has settled), and `job-status` reports the phase: `uploading`, `processing`, `done`, `failed`, `none`, or `unknown` when the server that started the upload is gone and the instance says nothing about assets. A deploy that had assets is `completed` only once they are in.
  * Polling could ask the wrong instance. `env` is optional on every tool, so a deploy started against `staging` and polled without one resolved to the *first* `.pos` entry and asked it about the same numeric id, which may well be another deploy there. A `job_id` names its instance: `job-status` uses the `.pos` environment that points at it, and otherwise refuses with `JOB_INSTANCE_MISMATCH` — naming both hosts, and without making a request.

* `pos-cli mcp-config` and the MCP server no longer read the tools configuration separately. `pos-cli mcp-config` listed the entries in the file rather than the tools the server exposes, did not validate the file, and so could print a configuration that the server then refused to start with. It also rejected a missing or unparseable `MCP_TOOLS_CONFIG` file that the server silently ignored. Both now use one loader. A file named by `MCP_TOOLS_CONFIG` that is missing, unreadable or not valid JSON still applies no configuration, but the server now logs a warning saying so, and `pos-cli mcp-config` shows it.

* An MCP tool name inherited from `Object.prototype` is answered as an unknown tool on every transport. Names such as `constructor` or `toString` resolved to something that was not a tool: `POST /call` answered 500 with `TypeError: entry.handler is not a function`, `POST /call-stream` opened an event stream only to report that the tool has no stream handler, and stdio `tools/call` and direct method calls returned the `TypeError` as a JSON-RPC error. A stdio request whose method was `toString`, `constructor`, `valueOf` or `hasOwnProperty` got no response at all, leaving the client waiting until it timed out. They now get `404` or `-32601`, like any other unknown name.
* `pos-cli mcp` and `pos-cli mcp-config` work. Both have been documented since the MCP server shipped, but neither was ever registered with `pos-cli`, so each printed `unknown command` and exited 1. `npx -y @platformos/pos-cli mcp` failed the same way: a package with several executables runs the one named after the package, `pos-cli`, which is how MCP client configurations using that form ended up with a server that never started — and MCP clients do not show its stderr. `pos-cli-mcp` remains the recommended command for client configurations, since it skips the launcher process; `npx -y -p @platformos/pos-cli pos-cli-mcp` works with every published version, whereas `npx -y @platformos/pos-cli mcp` needs this release.

* **Behaviour change:** `pos-cli-mcp` (and `pos-cli mcp`) now accepts only the tool-selection options (`--profile`, `--include-tools`, `--exclude-tools`), `--no-http`, `--help` and `--version`, and any other argument stops it with an error before either transport starts. Arguments used to be ignored, so registering `pos-cli mcp` without this would have made `pos-cli mcp --help`, `pos-cli help mcp` and `pos-cli mcp config` each start a server that never exited. It also means an option the server will grow later (tool profiles) cannot be mistyped into silently exposing every tool. An MCP client configuration that passes stray arguments to `pos-cli-mcp` now fails to start instead of starting with them ignored; remove the arguments. `pos-cli mcp config` points to `pos-cli mcp-config`.

* The MCP server now exits when its client closes stdin, which is how MCP clients stop the servers they start. A server whose HTTP listener had started ignored that: the listener kept the process alive after its client was gone, holding the port and serving the instance credentials it had resolved — one ran for eight days on the machine used to diagnose this — and a server started through `npx` outlived its client even when `npx` itself was stopped with SIGTERM. Shutdown is a drain: the transports stop taking new work, calls already running write their responses (over stdio and HTTP), work a tool continues in the background — `deploy-start`'s asset upload — finishes, and the process then exits by itself, releasing its port. A call still running after 120 seconds no longer holds the process. A server whose stdin is `/dev/null`, a file or a terminal keeps serving HTTP until it is stopped, as before, unless stdin carried MCP messages; start it as `pos-cli-mcp </dev/null` to run the HTTP transport on its own.

* **A tool's description is now written in one place.** `mcp-min/tools.config.json` shipped with a description for every tool, and the loader prefers the config's, so the `description` in each tool module was dead text that no client ever saw. Six had drifted apart, and in each case the better sentence was in whichever copy was not in use. Descriptions now live with the tool, and the bundled config ships overriding nothing. The override itself still works — a `description` in a file you point `MCP_TOOLS_CONFIG` at replaces the module's, as before. **If you copied the bundled file and edited it, your copy pins all 36 descriptions at the version you copied**, and no upgrade can change a description your own config restates; delete the `description` entries you did not deliberately write.

* **The tool descriptions an agent reads were rewritten against one standard.** They had been written tool by tool as each one landed and never reviewed as a set, so the same three credential parameters were described twenty-four times over (3,312 bytes of every `tools/list` restating one fact), `env` had three different wordings plus five tools that left it undescribed, and descriptions spent their bytes on API paths and internal endpoint names that an agent cannot act on. `env`, `url`, `email` and `token` are now described once, in the schema they are shared from, including the fallback that decides which instance a call without `env` reaches — which four tools used to warn about and twenty did not. Tools that an agent could mistake for validators now say what their result does not establish: a `liquid-exec` render is not evidence the code deploys, a `graphql-exec` mutation run to test a document has already written its data (and errors in the document come back as an instance failure carrying them in `details`), and `check-run` findings are meant to be read by check code rather than a pass or fail verdict. `tools/list` ends the release at 17,727 bytes for the full set and 6,006 for `--profile dev`, down from 25,764 and 6,920. It is sent on every request. Two parameters the reference documented but no tool accepted — `rawIds` on `data-import`, `isZip` on `data-import-status` — are gone from it, and a test now fails if the documentation names a parameter a tool does not declare.

### Security

* **A call that can change an instance now has to name one.** `env` is optional on every tool that authenticates, and has to stay that way: `resolveAuth` supports four call styles and only one of them passes it, so marking it `required` would reject explicit `url`+`email`+`token`, reject `MPKIT_*` in CI, and reject the single-environment default. But the last resolution step names no instance at all — it takes whichever entry happens to be first in a `.pos` the model has never seen, and an agent that forgot to pass `env` deployed, imported or cleaned whatever that was, silently. When the tool is not `readOnlyHint` and `.pos` holds more than one environment, that step is now refused with `kind: "input"` and `code: "ENV_REQUIRED"`, listing the environments and naming the one the call would have used, so the model can correct itself in one turn. The other three steps are untouched, one configured environment still resolves without ceremony, and tools that only read are never refused. The guarded set is derived from the annotation rather than a list, so a tool added later is covered by declaring what it is.

* **The MCP server's log no longer contains credentials.** It logged every request header — `Authorization`, `Cookie`, `Mcp-Session-Id` — and the full parameters of `POST /call`, which is where a client passes explicit `url`/`email`/`token`. Worse, `env-add` wrote its whole parameter object, including the instance API token it was given, at INFO: no `DEBUG` needed. The Partner Portal's device-authorization response, which *is* an access token, was logged whole at DEBUG. All of it went to `~/.pos-cli/logs/mcp-min.log`, which is append-only and outlives the session.

  Everything written now passes through one redactor (`mcp-min/redact.js`): credential headers, passwords and device codes are replaced entirely; `token`, `access_token`, session ids and the like are masked to `abc...xyz` — enough to tell which credential was used, not enough to use — and `Token …`/`Bearer …`/`Basic …` values, the password half of a URL, and sensitive URL query parameters are scrubbed out of message text too. A name is matched wherever the word appears in it, so `password_hint` and `token_value` are covered as well as `password` and `token`; a boolean is left alone, because `tokenProvided: true` is the fact a line like that exists to record. The deprecated HTTP routes no longer log parameters, results or JSON-RPC payloads at all — only the names, the tool and the outcome — since a tool's payload is the caller's shape (`constants-set` puts an instance's API keys under `value`) and a result re-encoded as a JSON string is something redaction cannot see into. `Gateway` logs its request header names rather than their values. The rest of the detail is kept, because that is what makes `DEBUG=1` worth turning on. The log file is now created owner-only (`0600`), and one left behind by an earlier version is tightened on the next start — **an existing `~/.pos-cli/logs/mcp-min.log` may still contain credentials written by an earlier release; delete it, and rotate anything it named.** Starting with `DEBUG=1` also no longer opens with a "tool params rejected" line for every tool that has a required parameter.

* **No MCP tool takes an `endpoint` argument any more.** It replaced the URL the request went to while the `.pos` token was still sent, so a caller that could reach the server — including a model persuaded by the content of a page, a log line or a data file it had just read — could name any host and have this machine's platformOS credentials delivered to it. It is gone from all eight tools that had it: `deploy-status`, `deploy-wait`, `logs-fetch`, `graphql-exec`, `liquid-exec`, `migrations-list`, `migrations-generate` and `migrations-run`. The request URL now always comes from the resolved credentials, every one of those schemas is closed, so a call still passing `endpoint` is rejected with `INVALID_PARAMS` rather than quietly ignoring it, and a test over the whole registry fails if any tool gains a parameter that could move a request off the resolved instance. Calling another instance is still supported the safe way — `url` with `email` and `token`, where the caller supplies the credential along with the host. `pos-cli fetch-logs --endpoint` is unchanged: on the command line a person chooses the host.

* **Restart your MCP clients after upgrading.** The MCP server's HTTP transport (`pos-cli-mcp`, port 5910) listened on every network interface and has no authentication, so anyone on the same network could list tools and run any enabled one — `data-clean`, `deploy-start`, `graphql-exec` — with the platformOS credentials the server resolved from its `.pos` or `MPKIT_*`. Every MCP client session started this listener, including the stdio sessions editors launch and keep running for days. It now binds `127.0.0.1` only. A server started by an earlier version keeps the port on all interfaces until it is stopped, and while it does, a new server cannot bind `127.0.0.1:5910` (on Linux the bind fails with `EADDRINUSE`), so localhost traffic keeps reaching the old, exposed process. Stop running `pos-cli-mcp` processes: restarting the editor or MCP client that launched them usually does, but a server launched through `npx` can outlive its client, so check for leftovers.

* The HTTP transport now checks `Host` and `Origin` on every route before the request body is read. Loopback alone does not keep out a web page open in your own browser: it can resolve its own domain to `127.0.0.1` (DNS rebinding) or post to `http://127.0.0.1:5910` directly. A request whose `Host` hostname — or `Origin` hostname, when present — is not `localhost`, `127.0.0.1` or `[::1]`, and one with no `Host` or with `Origin: null`, is answered `403` with a JSON-RPC error body. This is the Origin validation the MCP specification requires of HTTP transports, with the same checks and messages as the MCP TypeScript SDK's Express middleware. Clients that do not send `Origin` (curl, SDK clients) and pages served from localhost are unaffected.

* Exposure beyond loopback is now an explicit choice. `MCP_MIN_HOST` sets the bind address (for example `0.0.0.0` inside a container) and the server logs a warning on every start that the port is reachable without authentication; `MCP_MIN_ALLOWED_HOSTS` adds hostnames to accept in `Host`/`Origin`. Host/Origin validation stays on in that mode. A malformed `MCP_MIN_HOST`, `MCP_MIN_ALLOWED_HOSTS` or `MCP_MIN_PORT` stops the server at startup with a message naming it, instead of binding somewhere else or keeping an allowlist entry that can never match — a non-numeric `MCP_MIN_PORT` used to be taken as a named-pipe path and create a socket file in the working directory.

* A failed bind is no longer reported as success. The server logged `HTTP server listening` even when the port was taken, which during an upgrade would have claimed the new, protected listener was running while the old, exposed one answered. It now logs the address actually bound — or `HTTP transport not started` with the error code, host and port — and keeps serving MCP over stdio either way.

* The documentation no longer claims the HTTP transport requires a Bearer token, API key or rate limit; none of those were ever implemented. `mcp-min/README.md` now describes the actual protection and its limits, and the documents that made those claims are gone (see Removals).

* **The `check` MCP tool is removed, and with it a way to run arbitrary commands.** It assembled a shell command by string concatenation from its own parameters — `config`, `appPath` and `category` all went in unquoted — and ran it through a shell, so anything that could call the tool could run any command as the user running the server. It was the only part of the MCP server that touched `child_process`. Reaching it took a deliberate edit: the tool was disabled in the bundled tools config, and `--include-tools` refuses a tool the config disables, so no default install exposed it. It is gone rather than patched, because it duplicated `check-run` — which runs the linter in-process, with no shell — and shelled out to an executable a pos-cli install does not provide, so it could not have worked anyway.

* `data-clean`, `constants-unset`, `deploy-start` and `sync-file` are published with `annotations.destructiveHint`, so a client that gates destructive tools has something to gate on. Each can delete something on the instance — a deploy that is not partial removes whatever is missing from the build — and `data-clean` said so only in prose, where nothing but a person could act on it.

## 6.5.1 (2026-09-17)

### Fixes

* A Partner Portal that is being deployed no longer looks like a bad token. An instance cannot validate an API token by itself — the Portal owns that answer — so while the Portal is down, restarting or rate-limiting, the instance has no verdict at all, and it used to report that as a `401`, which pos-cli printed as "You are unauthorized to do this operation. Check if your Token/URL or email/password are correct. To refresh your token, run: pos-cli env refresh-token". Every client saw it at once, none could tell it from a revoked token, the advice could not work because the credential was never judged, following it cost a working token, and the whole thing stopped reproducing a minute later. Instances now answer `503 partner_portal_unavailable` with a `Retry-After` and the reason, and pos-cli waits it out: every Gateway request is made up to five times, pausing between attempts for as long as the instance's `Retry-After` asks (clamped to 2–30s), and says once why it is holding. A Portal deploy is over well inside that, so what used to be a failed deploy is a pause. A `503` without that body — an instance that is itself down behind its proxy, say — is reported as the server being temporarily unavailable, with no advice about the token, where it used to be printed as the raw response body. A `401` or `403` from the Portal is still a `401` here — that is the Portal deciding, and re-authenticating really is the answer to it. Requires the matching platformOS release; against an older instance a Portal outage still surfaces as the old message.

* The step-up itself names the Portal when the Portal is the thing that is not answering. `pos-cli` talks to the Portal directly to trade a code for a two-factor session, and a 5xx or a refused connection on that leg was reported by the generic HTTP handling as either "You are unauthorized to do this operation" or "Could not connect … make sure the server is running" — the first blames a credential that was never checked, the second reads as advice about the instance being deployed to, which is the one host that is demonstrably fine. Both now end in the same message: that the Partner Portal at its URL is not answering, with the HTTP status or the connection error in brackets; that it is the only thing that can verify the credentials, so pos-cli cannot continue without it; that nothing is wrong with the token and `pos-cli env refresh-token` cannot fix it; and to try again in a minute. A 5xx, a `408`, `425` or `429`, or a connection that never completed count as the Portal not answering. A `401` or `403` does not — that is the Portal deciding — and is handled by the two-factor prompt exactly as before.

## 6.5.0 (2026-09-09)

### New Features

* Every command that talks to an instance now obtains a two-factor session when that instance's Partner Portal requires one — `deploy`, `sync`, `exec`, `exec-graphql`, `exec-liquid`, `constants`, `data export`/`import`, `migrations`, `logs`, `pull` and the GUI. Reads are covered as well as writes: a token reaches every record through GraphQL and runs arbitrary Liquid through `exec liquid`, so protecting only deploys would have protected only the source code. `deploy` and `sync` ask up front, before doing any work; the rest ask when the instance refuses and then retry. The code is exchanged with the **Portal** for a short-lived session token (8 hours) which is cached as `two_factor_session` inside that environment's entry in `.pos` — tightening the file to 0600, since it now holds a credential shorter-lived than the year-long token beside it — so the prompt appears once per session and not once per command. Settings taken from `MPKIT_*` have no `.pos` entry behind them and keep the session for the life of the process instead. `--otp-code` and `POS_PORTAL_OTP_CODE` skip the prompt for scripts, and `POS_PORTAL_SESSION_TOKEN` supplies a session minted elsewhere. The prompt is raised before any spinner starts — a spinner repaints its line on a timer and used to paint straight over it, which looked like a hang. The prompt attributes the requirement to the Partner Portal account and lists the Instance, the portal and the account's email beneath it: 2FA is enabled on the account, not on the Instance, and `pos-cli deploy staging` names none of the three — so there was nothing on screen to confirm what a code was about to unlock. The email is the one stored for the environment in `.pos`; environments added through the browser device flow store none and that line is omitted. Note that the code never travels through the instance: instances run tenant-authored Liquid, so one that passed through could be harvested and replayed inside its 30-second window. Requires the matching Partner Portal and platformOS releases; against a portal or instance without them, nothing changes.

* Partner Portal accounts with two-factor authentication enabled can now authenticate from the CLI. `pos-cli env add --email`, `pos-cli env refresh-token`, `pos-cli modules push` and the `pos-cli dns` email fallback prompt for a code (a recovery code works too) when the portal asks for a second factor, and retry the request with it. `--otp-code <code>` and the `POS_PORTAL_OTP_CODE` environment variable skip the prompt for scripted use; a non-interactive run explains what to set instead of hanging on a prompt that nobody can answer. A rejected code says so instead of blaming the password, and an account the portal has locked for too many attempts stops immediately rather than spending prompts on codes that would be refused unread. pos-cli gives up after three rejected codes, short of the portal's 5-attempt budget, so a typo here cannot trigger the 15-minute lock that is shared with the web UI. Previously these commands reported every one of these as "check if your email/password are correct", which left no way to tell a 2FA challenge from a wrong password — the browser-based `pos-cli env add --url` device flow was unaffected and remains the simplest option. Portals older than the `two_factor_invalid`/`two_factor_locked` responses are still handled: a code pos-cli sent itself can only have been refused for being wrong, since the portal would not have asked for one unless the password had already passed.

* A two-factor session that ages out mid-`sync` ends the run once, with a message naming the command to run again, instead of refusing every following file change one line at a time. Watch mode deliberately never prompts where it stands: its queue is mid-flight and nobody need be at the keyboard. Under `pos-cli gui serve --sync` this stops the web server with it — the GUI proxies its own requests through the same credential, so a session the watcher has just been refused is one no panel query can use either, and staying up would serve a GUI that fails everything with the explanation already scrolled away.

* Every writer of `.pos` now writes it owner-only (`0600`) and tightens a file an earlier version left at `0644`. The file holds a year-long API token, so one writer leaving it world-readable undid what the others did. Handled in one place (`lib/filePermissions.js`) rather than per call site, because the mode passed to `writeFileSync` applies only on creation while `chmod` is what fixes a file already there; on Windows, which has no POSIX mode bits, it is a documented no-op.

* Updated the platformOS toolchain packages: `@platformos/platformos-check-node` to `^1.1.0`, `@platformos/platformos-common` to `^0.2.0`, `@platformos/platformos-language-server-node` to `^0.1.1`, `@platformos/platformos-mcp-supervisor` to `^0.2.0`.

* The minimum supported Node.js is now **22.13.0** (previously 22). It follows from the dependencies rather than from our own code: `commander` 15 is ESM-only and relies on `require(esm)` (>=22.12.0), and `inquirer` 14 declares `^22.13.0`. The `postinstall` check enforces it, so an unsupported Node fails at install time instead of part-way through a command. Major bumps landed with it — `commander` 14 → 15, `inquirer` 13 → 14, `chalk` 5 → 6, `execa` 9 → 10, `degit` 2 → 3, `yeoman-generator` 7 → 8 — and two behaviour changes are absorbed inside pos-cli rather than passed on: `inquirer` 14 renamed the `list`/`string` prompt types `pos-cli init` uses to `select`/`input`, and `commander` 15 stopped defaulting a `--no-x` flag to `true` when its positive counterpart is also declared, which `pos-cli dns`'s `--backup`/`--no-backup` handling now reads correctly under either version.

* The bundled web GUIs were rebuilt on current toolchains, driven by dependency advisories in the old ones. The admin panel (`pos-cli gui serve`, port 3333) moves to Svelte 5 and Vite 6, and the GraphQL browser at `/gui/graphql` to GraphiQL 5 with React 19 and `graphql` 17, whose Monaco-based editor now ships its web workers as separate prebuilt files beside the bundle. The MCP server's own `express` moves to 5 and `body-parser` to 2, matching the CLI.

### Fixes

* `pos-cli check -a` no longer pays for a second whole-project lint when there is nothing to fix. The autofix pass was gated on how many offenses were *reported* rather than how many autofix can actually write, and most checks are suggest-only — so a project whose findings are all suggestions re-linted itself in full to produce a byte-identical list (3.1 s of a 14.5 s run on a real 1509-file project with 454 offenses, none of them fixable). A run narrowed with `-c/--check` now applies that filter to the post-fix results too; they came back unfiltered before, so the fix pass silently widened the report to every check. The re-lint stays whole-project rather than narrowed to the files autofix wrote, deliberately: a fix to a partial's `{% doc %}` params changes that partial's contract and can resolve a caller's offense in a file autofix never touched, and re-linting is also what keeps line numbers honest, since every offense after a fix in the same file shifts. The MCP `check-run` tool had the same gating bug and additionally reported `autoFixed: true` for a pass that wrote nothing.

* `pos-cli check init` now writes `ignore: [node_modules]` instead of `ignore: [node_modules/**]`. Since platformos-check 1.1.0 a pattern containing a slash is anchored to the project root, so `node_modules/**` stopped covering a nested `modules/<name>/node_modules`; a bare name matches at any depth and covers the directory's contents as well as a file of that name.

* `pos-cli sync` now recognizes the same module assets that `pos-cli deploy` does. It required a module directory name of word characters only and accepted just `public/assets`, so an asset in a module whose name contains a hyphen (`common-styling` — the norm) or one under `private/assets` was not treated as an asset at all: it went out through the ordinary code-file path, which does not preserve the file byte for byte and leaves its Content-Type to be derived remotely instead of being sent with the upload — enough to silently break a `.js` or `.css`. The uploaded path now strips either the `public/assets` or the `private/assets` prefix, the way the manifest does. Where a module ships the same asset under both, the two resolve to one CDN path and deploy serves the private copy, so syncing the public copy is now skipped with a warning naming the file to edit instead of uploading content the next deploy silently replaces.

* `pos-cli sync -f <file>` no longer fetches an asset-upload authorization for a file that is not an asset. It has no use for the answer either way, and on an instance that cannot presign an upload the fetch failed — taking the sync of an ordinary page or partial down with it.

* `pos-cli deploy` and `pos-cli sync` now work against an instance with no object storage configured, which cannot presign a direct asset upload and answers `501`. That used to end the deploy and stop sync before the watcher was even up. Both now fall back to sending assets through the instance itself, with a warning saying so: deploy puts them inside the release archive (what `--old-assets-upload` has always done) and sync pushes them through the sync endpoint, the path it used before direct upload existed. Deploy asks before building the archive, since the answer decides what goes into it. Only the `501` is read as a routing decision — a `401`, a `403` or a dropped connection says nothing about where assets belong and is still reported as the failure it is.

* The GUI's database table prints `null` for a null property value instead of leaving the cell empty, where it was indistinguishable from an empty string.


* Inbound input is now validated against JSON Schema (Ajv, draft-07) before it reaches a handler. Tool parameters are checked on all five MCP dispatch paths (`POST /call`, `POST /call-stream`, JSON-RPC `tools/call` over HTTP and over stdio, and stdio's legacy direct invocation) against the very `inputSchema` that `tools/list` advertises, so the published contract and the enforced one cannot drift; the GUI server validates its graph, liquid, logs, logsv2 and sync requests the same way. A rejected call answers `400` (`-32602` over JSON-RPC) instead of reaching a Gateway call with, say, a number where a URL belongs. A schema of ours that fails to compile answers `500` (`-32603`) and still rejects, because nothing was actually checked. `env` stays optional on tools that authenticate, so all four supported credential styles keep working.

* `mcp-min/tools.config.json` is validated too, and fails closed. A missing or unparseable file still falls back to defaults, but one that parses and is invalid is now an error — including one naming a tool that does not exist, where a typo like `deploy-strt` used to leave `deploy-start` enabled while the config looked like it had taken effect. That file decides which tools are exposed, so a broken one must not be ignored. `pos-cli mcp` reports it as a message rather than a Node stack trace.

* The MCP HTTP server's SSE session ids now come from `randomUUID` instead of `Date.now()` with `Math.random()`. The session id is the only thing separating one client's stream from another's, and `Math.random()` output is predictable from a couple of prior samples, so a local caller could derive an id and attach to someone else's session.

* The GUI server now applies a request rate limit (2000 requests per minute). It is a ceiling on abuse rather than a throttle on normal use: one GUI page load pulls dozens of static files through the catch-all route, so the limit sits far above anything a developer clicking around can reach.

* `pos-cli dns`'s `--drop-value` patterns are bounded before they are compiled — at most 200 characters, printable ASCII only, since DNS record values are printable ASCII (international names arrive as punycode) and anything outside it could not match a record anyway. An invalid pattern now names the flag that carried it instead of surfacing as a bare `SyntaxError` mid-migration.

### Removals

* The legacy admin panel is gone. `pos-cli gui serve` used to start a second server on `port + 1` serving the pre-Svelte GUI from `gui/admin`, duplicating the panel served on `3333`. It was removed as part of clearing dependency advisories: it was pinned to a rollup/Svelte 3 toolchain whose transitive advisories had to be patched with overrides to keep it building. `gui/admin/dist` is no longer part of the npm package.

## 6.4.0 (2026-08-20)

### New Features

* `pos-cli check run` now reports what it actually examined. A clean run prints `Checked N files. No offenses found.`, and a run that examined nothing prints `Nothing was checked: no source files found` together with which extensions and directories count as source files — so an empty project or a wrong directory no longer produces the same output as a genuinely clean run, which a CI job would read as a pass. JSON output gains a `filesChecked` field (distinct from `fileCount`, which counts only the files that have offenses; the MCP `check-run` tool's `filesChecked` had been reporting nothing since platformos-check-node 1.0.0 and is fixed too). Pointing `check run` at a directory that is not a platformOS project root now prints an explanation instead of a stack trace.
* Updated the platformOS toolchain packages: `@platformos/platformos-check-node` to `^1.0.0`, `@platformos/platformos-common` to `^0.1.0`, `@platformos/platformos-language-server-node` to `^0.1.0`, `@platformos/platformos-mcp-supervisor` to `^0.1.0`.

### Fixes

* `pos-cli modules install/update` no longer leaves a module directory whose manifest claims a version its files don't match — the state behind "the version was bumped but the code is stale and a file is missing". Archives are now unpacked into a throwaway staging directory under `tmp/` and swapped into `modules/<name>` only once complete, so an interrupted install leaves either the old module or no module, and both are correctly re-downloaded next run. The swap moves the old directory aside rather than unpacking over it, so files a new version no longer ships are actually removed. Previously the module directory was deleted and the archive unpacked over it in place: an interruption left a partial tree, and because staleness is detected by reading the version out of the module's own `pos-module.json`, a partial tree that had already written that file looked up-to-date to every later `install` and `update` — the stale code then shipped on the next deploy.
* `pos-cli modules install/update` now rejects an archive that does not contain the expected `<module-name>/` directory. Such an archive used to delete `modules/<module-name>`, unpack its differently-named root beside it, and still report success.
* `pos-cli modules install/update` waits for every module download to settle before reporting a failure. A failing module used to abort the command while its siblings were still being replaced on disk, so a Ctrl-C at the error prompt could interrupt an install that appeared to be over. All download failures are now reported together instead of only the first.
* `pos-module.lock.json` is written only after every module has downloaded successfully. Writing it up front recorded versions that were never installed, and the next run — seeing the lock and the modules that *did* download agree — had no way to tell the install was incomplete.
* File downloads (module archives, data exports, `pos-cli pull`) now fail on a non-2xx response instead of saving the error body as the downloaded file, and follow redirects. An expired presigned URL answers `403` with an XML body, which used to be written out as a `.zip` and only surfaced later as a corrupt-archive error. Signed query strings are stripped from error messages.
* Ctrl+C now reliably interrupts `pos-cli check run` — and works while any pos-cli spinner is up. The spinner used to put the terminal into raw mode to keep typed keys from echoing over the spinner line, which also switched off the terminal's own Ctrl+C handling without reinstating it, so `^C` did nothing at all. Spinners no longer discard stdin (typed keys may echo over the spinner line), and the linter itself now runs on a worker thread so the main thread stays responsive to the signal while files are being checked.
* `pos-cli constants set` now works with multiline values such as PEM keys and certificates: the value is passed as a GraphQL variable instead of being interpolated into the mutation string, where line breaks produced an invalid query. `constants list`/`set`/`unset` — and the GUI's constants page — now also detect errors returned in the GraphQL response body: a failed mutation used to crash with a TypeError on the missing result (or claim success) instead of stating what went wrong.
* `pos-cli sync` no longer exits when an asset upload fails — the error is reported and watch mode keeps processing its queue (single-file `pos-cli sync -f` still exits non-zero). The direct-upload authorization fetched once at sync start expires after a while, after which every asset upload came back `403`; an expired authorization is now refreshed and the upload retried once, with concurrent uploads sharing a single refresh. A failure while registering uploaded assets (the manifest request) no longer crashes the process either: the batch is put back and retried on the next flush.
* `pos-cli deploy` waits for the asset-processing report using the release's dedicated asset status instead of guessing from the overall release status: a deploy with no assets skips the wait entirely (it used to poll for a report that could never arrive), server-side asset processing failures are printed instead of silently swallowed, hitting the 10-minute timeout produces a visible warning instead of a debug line, the spinner shows how long the wait has been running, and polling backs off over time instead of refetching the full release record every second.

## 6.3.0 (2026-07-27)

### New Features

* `pos-cli dns` — new command group for migrating an instance's custom domains and DNS records between Partner Portal deployments (e.g. from `partners.platformos.com` to a private-stack portal). `dns export` snapshots all domains/records to a versioned JSON backup (bulk via `--instances-file`, sharing one backup directory per run, one file per instance); `dns migrate <sourceEnv> <targetEnv>` copies them portal-to-portal (dry-run support, always writes a backup first, source portal is read-only) and prints per-domain cutover instructions (registrar nameservers for `domain-full`, SSL validation records + CNAME/A targets for `domain-external`); `dns import --file` applies a saved export; `dns status` shows each domain's provisioning status and pending cutover steps; `dns compare` verifies parity between the two sides and exits non-zero on real differences. Bulk cohort support via `--instances-file`/`--mapping-file`, with a per-instance summary table (applied/blocked/error counts).
* Safety: the plan is displayed and must be confirmed interactively before anything is applied — the prompt names the actual instance being written to — with `--yes` to skip in scripts/CI; `partners.platformos.com` is protected as read-only and can only be a migration source, so an accidental `migrate <target> <source>` argument swap fails immediately (`--unsafe-allow-protected-target` to override); `--json` runs refuse a blind interactive confirmation (pass `--yes` or `--dry-run` instead); exit codes are unified and documented across single and bulk modes (0/1/2/3).
* `dns compare` filters out expected cross-stack noise (data centers, nameservers, MX case, TXT chunking, and records whose name one DNS provider stores fully-qualified and another stores short) while still catching real differences (status, setup type, record intent, and any field an export had to strip for exceeding the size limit); `--drop-value` excludes records a migration intentionally dropped; `--domain` scopes both single-pair and bulk (`--mapping-file`) runs; `--raw` compares byte-for-byte instead.
* Network failures during any `dns` command get the same friendly, host-naming error messages the rest of pos-cli uses.

### Fixes

* `pos-cli-mcp` no longer crashes the entire server when a single tool hits a fatal error. The MCP server runs all tools in one process, so a fatal `logger.Error` — which calls `process.exit(1)` — used to tear down the whole server and every tool it exposed, forcing a reconnect. Under the MCP server, fatal errors now throw instead of exiting, so the per-request handler returns a clean error and the server stays up. Standalone CLI behavior is unchanged (it still exits on fatal errors). The most common trigger — a tool called with an unresolvable environment — now returns a caught error instead of killing the server.

## 6.2.3 (2026-07-23)

### Fixes

* `pos-cli deploy` now also includes each module's own `modules/<name>/pos-module.json` manifest in the deploy archive (still excluding the rest of a module's authoring content — generators/, package.json, template-values.json, README, etc.). This lets the instance tell "module has no files in this deploy" apart from "module's files are present but stale versus the lock file" and warn accordingly, instead of silently deploying outdated module content when `pos-cli modules install` wasn't rerun after pulling a bumped lock file.

### Security

* Bumped `yeoman-environment` from `^5.1.3` to `^6.1.0`, fixing a high-severity arbitrary package installation vulnerability ([GHSA-vv9j-gjw2-j8wp](https://github.com/advisories/GHSA-vv9j-gjw2-j8wp)).
* Replaced the unmaintained `node-notifier` (last published 2022, still on vulnerable `uuid@^8.3.2`) with `toasted-notifier`, an actively maintained fork with the same `.notify()` API, fixing a moderate-severity buffer bounds check issue in `uuid` ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)).

## 6.2.2 (2026-07-22)

### New Features

* `pos-cli modules push` now includes `pos-module.lock.json` in the release archive (alongside `pos-module.json`, `template-values.json`, and `README.md`) when the module has one.
* `pos-cli deploy` now embeds a resolved `pos-module.lock.json` at the root of the deploy archive — using the project's own lock file when present, or merging any `modules/<name>/pos-module.lock.json` files found on disk otherwise (e.g. a module dropped into a bare `modules/` directory with no root manifest) — so the instance can see the full module dependency tree.

## 6.2.1 (2026-07-22)

### Fixes

* `pos-cli modules install`/`update` (and `--frozen`) now redownload a module whose on-disk content is stale, instead of only checking whether its directory exists. The installed version is read from `modules/<name>/pos-module.json`, falling back to `modules/<name>/template-values.json` for modules published before the `pos-module.json` convention existed.

## 6.2.0 (2026-07-21)

### New Features

* `pos-cli ai init` — one-step wizard that registers pos-cli's MCP servers (`platformos` and `platformos-supervisor`) in your AI tool's project configuration. Supports Claude Code (`.mcp.json`), Cursor (`.cursor/mcp.json`), and VS Code (`.vscode/mcp.json`); prints a manual JSON snippet for other tools. Existing configuration files are merged, never overwritten, and re-running is a no-op. Pass `--tool <name>` to skip the interactive prompt.
* `pos-cli-supervisor` — new MCP server binary exposing `validate_code` for Liquid/GraphQL/YAML validation, wrapping `@platformos/platformos-mcp-supervisor`.

### Fixes

* Logger output (`Warn`/`Info`/`Print`) is now properly awaited in `pos-cli data clean`, `pos-cli generate list`/`run`, `pos-cli logsv2 reports`, and the production-environment confirmation prompt, preventing messages from printing out of order.

## 6.1.0 (2026-07-01)

### New Features

* `pos-cli deploy --dry-run` is now enabled for all users. Validates the release on the server and reports which files would be upserted or deleted without applying any changes.
* **Unified `pos-module.json` manifest** — single project manifest (analogous to `package.json`) holding both module identity (`machine_name`, `version`, `name`, `repository_url`) and `dependencies`/`devDependencies`. Replaces `app/pos-modules.json` and metadata fields previously kept inside `template-values.json`. Legacy `app/pos-modules.json` is still read as a fallback.
* **`pos-module.lock.json` is now self-contained** — every resolved module is stamped with the registry URL it came from in a `registries` map, so `--frozen` installs no longer rely on the ambient default registry. Old lock files without per-module entries fall back to the hardcoded default.
* **Per-module registry overrides** — declare a `registries` map in `pos-module.json` to resolve specific modules from a private or custom registry.
* `pos-cli modules install --frozen` — CI-safe install. Uses the lock file as-is, performs no registry resolution, and fails fast if the lock file is missing or stale.
* `pos-cli modules install --dev` / `pos-cli modules update --dev` — manage `devDependencies` independently from `dependencies`. `install <name> --dev` adds the module to `devDependencies`; without a name, `--dev` includes both sections in the resolution.
* `pos-cli modules show <module-name>` — display all available versions of a module from the registry, and re-display the module's post-install message when it is installed locally.
* **Module post-install messages** — modules can ship declarative setup instructions (a `postInstall.message` field in `pos-module.json`, or a `POST_INSTALL.md` file) that pos-cli prints after the module is downloaded, analogous to RubyGems' `post_install_message` / Homebrew's caveats. The text is **never executed** (no npm-style `postinstall` hook) and is sanitised before printing. Shown for modules downloaded during a run plus the explicitly named module; `--frozen` (CI) installs print nothing. See `bin/modules.md` for the authoring format.
* `pos-cli modules uninstall <module-name>` — remove a module from `pos-module.json`, re-resolve the dependency tree, and clean up the `modules/` directory. Use `--dev` to remove from `devDependencies`.
* `pos-cli modules build` — package the current module into a release archive without uploading.
* `pos-cli modules migrate` — upgrade an existing project to the new manifest format. Runs two independent, idempotent phases:
  - **Phase A**: converts `app/pos-modules.json` → `pos-module.json` (`modules` key → `dependencies`)
  - **Phase B**: lifts `machine_name`, `version`, `name`, `repository_url` from `modules/<name>/template-values.json` into `pos-module.json` and strips them from the source file. Use `--name <machine_name>` when multiple `template-values.json` files are present.
* `pos-cli exec graphql` and `pos-cli exec liquid` accept a `-p, --params` flag to pass GraphQL variables / Liquid context as a JSON object; combinable with `-f` to supply variables for a query read from a file.

### Improvements

* `pos-cli modules version` now accepts a semver **bump type** (`major`, `minor`, `patch`) in addition to an explicit version, and defaults to `patch` when no argument is given.
* `pos-cli modules version` synchronizes the version into `modules/<name>/template-values.json` (when the file exists and already has a `version` field).
* `pos-cli modules version` automatically creates a git commit and tag for the new version. Use `--no-git` to skip; the command refuses to run on a dirty working tree.
* `pos-cli logs` renders structured Liquid diagnostics as compiler-style blocks; the legacy `{% log %}` context (url/page/partial/email) keeps its one-line rendering.

### Fixes

* Sync no longer crashes when the OS file-watch limit is reached (`EMFILE`/`ENFILE`/`ENOSPC`) — the error is now reported with recovery guidance instead of aborting. `node_modules` and `.git` are pruned from the watch set, and `.DS_Store` exclusion is restored for chokidar v4+.
* Fixed a race condition in error handling for `pos-cli exec graphql` / `pos-cli exec liquid`.

## 6.0.6

### Chore

* Rebuilt GUI assets
* Stabilized CLI integration test for `pos-cli check`
* Updated `package.json` / `package-lock.json` (dependency refresh)

## 6.0.4

### Fixes

* Fixed missing `await` in `pos-cli fetch-logs` causing the command to exit before logs were returned

### Chore

* Finished CommonJS → ESM conversion for remaining files (test helpers, MCP validators, fetch-logs bin)
* Removed leftover `lib/initilizeEsmModules.js` shim

## 6.0.2 / 6.0.3

### Fixes

* Fixed 404 errors from `pos-cli gui serve` SPA fallback by serving `index.html` via Express 5's updated `res.sendFile` API
* Updated server error message format for unknown form properties (now prefixed with the file path)

### Chore

* Rebuilt GUI assets

## 6.0.1

### New Features

* `pos-cli check run -c, --check <name>` — filter linter output to a specific check by name (repeatable flag; validates names and lists available checks on mismatch)

### Improvements

* `pos-cli deploy` now displays warnings returned by the server alongside deploy results
* `pos-cli deploy --dry-run` now supports assets: generates an asset manifest and reports which assets would be added/removed without uploading them
* `pos-cli deploy` reports asset changes (added/removed) in the deploy summary

### Fixes

* Fixed `pos-cli env refresh` — refactored token refresh into `lib/envs/refreshToken.js` with correct error handling
* Fixed `pos-cli constants` commands (`list`, `set`, `unset`) broken by ESM named-export migration
* Fixed `pos-cli archive` broken by ESM named-export migration

## 6.0.0

### Breaking Changes

* **Node.js 22+ required** (up from Node.js 18)
* **`pos-cli modules download` removed** — use `pos-cli modules install` instead. The `--force-dependencies` flag is not carried over; install/update always downloads all dependencies.
* **CommonJS to ESM migration** — entire codebase migrated from `require`/`module.exports` to `import`/`export`
* **Test framework migration** — migrated from Jest to Vitest
* **Yeoman generators**: If you have custom generators using `yeoman-generator`, they need to be rewritten for the v7.x update:
   - No kebab-case in option names (e.g., `skip-install` → `skipInstall`)
   - `composeWith()` is now async (use `await`)
   - The `install()` action has been removed; use `addDependencies()` instead
* **Express v5 route syntax**: Routes using wildcards have changed from `/*` to `/*splat` format. This is handled automatically, but if you have custom Express middleware in your project, you may need to update route patterns.

### New Features

* `pos-cli mcp` — MCP (Model Context Protocol) server exposing 30+ platformOS tools over stdio and HTTP/SSE transports. Enables AI clients (Claude, Cursor, etc.) to interact with platformOS instances directly.
* `pos-cli mcp-config` — display and inspect the MCP server tool configuration (which tools are enabled/disabled). Supports `--json` for raw output. Configurable via `MCP_TOOLS_CONFIG` env var.
* `pos-cli lsp` — start the platformOS Language Server Protocol server for Liquid, GraphQL, and JSON files. Provides autocompletion, diagnostics, hover docs, and go-to-definition in LSP-compatible editors.
* `pos-cli check init [path]` — generate a `.platformos-check.yml` configuration file for the Liquid code quality checker.
* `pos-cli check run [path]` — run the platformos-check Node.js linter on Liquid/JSON files. Supports `-a` (auto-fix), `-c, --check <name>` (filter by check name, repeatable), `-f json` (JSON output), `-s` (silent). No Ruby required.
* `pos-cli check update-docs` — download the latest platformOS Liquid documentation used by the linter, keeping checks like `UndefinedObject` and `UndefinedFilter` up to date.
* `pos-cli fetch-logs [environment]` — fetch recent logs as NDJSON (newline-delimited JSON), designed for machine consumption and used internally by the MCP server. Supports `--last-log-id` for incremental polling.
* `pos-cli exec liquid` — execute Liquid code directly on an instance (supports `-f` flag to load from file, requires confirmation on production)
* `pos-cli exec graphql` — execute GraphQL queries directly on an instance (supports `-f` flag to load from file, requires confirmation on production)
* `pos-cli test run` — run tests using the tests module
* `pos-cli sync -f <file-path>` — sync a single file and exit (useful for CI/CD workflows)

### Improvements

* `pos-cli modules install` now always downloads module files and all dependencies after updating the lock file, ensuring source code is always in sync with the manifest.
* `pos-cli modules update` now always downloads updated module files and all dependencies after updating the lock file.
* Enhanced error handling for `pos-cli env add` with clearer messages when instance is not registered in Partner Portal
* Better error messages for sync validation errors (422 responses) with detailed error descriptions
* Added graceful shutdown handling for sync mode to properly cleanup watchers and LiveReload servers
* Improved browser opening error handling with better error messages for failed attempts
* Enhanced refresh token error handling during authentication flows
* Added test coverage measurement capability

### Chore

* Replaced `archiver` with `yazl` for zip archive creation
* Upgraded `commander` to v14
* Updated ESLint configuration and fixed linting errors across the codebase
* All deprecation warnings across dependencies resolved
* All major dependencies updated to latest stable versions: chalk v5.6, chokidar v5.0, express v5.2, ora v9.0, open v11.0, inquirer v13.2, mime v4.1, multer v2.0, yeoman-environment v5.1, yeoman-generator v7.5, and many more

### Temporarily Disabled

* `pos-cli deploy --dry-run` asset report is not yet active while the feature is being propagated to all servers. The dry-run command is available and reports code changes; asset reporting will be enabled once the rollout is complete.

## 5.5.0

* Feature: (GUI) Ability to add, edit and remove users

## 5.4.1

* Improvement: `pos-cli modules download <module>` removes the modules/<module> before unpacking the new version to automatically handle scenario when a file is being removed from the module in a new version

## 5.4.0

* Improvement: `pos-cli modules download <module>` will by default download version defined in app/pos-modules.lock.json file
* Improvement: `pos-cli modules download <module>` will automatically download all dependencies defined in module's template-values.json file if they do not exist yet
* Improvement: Add `--force-dependencies` flag to `pos-cli modules download <module>` command to force re-downloading dependencies

## 5.3.0

* Feature: `pos-cli modules overwrites` utility commands
* Feature: `pos-cli clone init` to initiatie InstanceCopy, works across stacks
* Bug: Updated `unzipper` to newest version to fix occassional issue with pos-cli modules download

## 5.2.0
* Feature: (GUI) Show custom properties in user details panel
* Improvement: Better handling of template-values.json during pos-cli modules push

## 5.1.5
* Improvement: Always store generated `asset_manifest.json` in tmp/ for debugging purposes
* Chore: Removed unused `readdirp` node package
* Chore: Removed `valid-url` node package and replaced it with native Node validation

## 5.1.4
* Chore: Remove `pluralize` node package
* Chore: Replaced `uuid` node package with native Node UUID generator
* Chore: Disable gzip compression for Express server and remove the `compression` package
* Chore: Remove unused `js-yaml` dependency

## 5.1.3
* Improvement: Force more engaging test on data clean

## 5.1.2
* Chore: Removed unused `async` node package
* Chore: Remove `extract-zip` dependency
* Bug: Fixed generators not generating

## 5.1.1
* Chore: Updated `commander` to newest version
* Chore: Updated `open` to newest version

## 5.1.0
* Feature: (GUI) Added pagination to Logs v2
* Improvement: Ingore .DS_Store files on macOS while syncing not to spam the terminal with messages of it being unrecognized

## 5.0.0
* Chore: Support for Node < 18 dropped
* Bug: (GUI) Fixed update message not being visible in dark mode

## 4.25.0
* Improvement: Better error handling for pos-cli modules pull
* Improvement: Allow to install a module if `app` directory is missing
* Bug: Fixed installing `pos-cli` on `npm` versions > 10.3.0

## 4.24.1
* Chore: Updated dependencies

## 4.24.0
* Chore: Updated dependencies
* Feature: (GUI) Show information when new `pos-cli` version is available

## 4.23.1
* Bug: (GUI) Remved hover state on Safari for Logs v2 and Network Logs tables cause of Safari rendering bug

## 4.23.0
* Feature: (GUI) Added Logs v2 and Network Logs to home screen
* Feature: (GUI) Using median to show the average request processing time and showing min/max in the tooltip

## 4.22.0
* Feature: (GUI) Ability to use predefined filters presets in `/network`
* Feature: (GUI) Ability to save custom filters presets in `/network`

## 4.21.2
* Bug: Fixed deploy not showing an error message when the release package is too large

## 4.21.1
* Bug: (GUI) Fixed parsing non-existent properties when displaying records

## 4.21.0
* Feature: (GUI) Ability to sort Network Logs

## 4.20.1
* Chore: (GUI) Updated build files

## 4.20.0
* Feature: (GUI) Added ability to aggregate Network Logs by request URL

## 4.19.0
* Feature: (GUI) Added ability to show currently running background jobs
* Feature: Added `modules update` command
* Improvement: (GUI) Made browsing logs detail faster in Logs V2
* Feature: (GUI) Added ability to filter Network Logs by Status Code
* Feature: (GUI) Extended information available in Netwok Log detail with 'execution duration' and 'response size'

## 4.18.1
* Bug: Fixed `pos-cli logs --filter` to consider log `type`

## 4.18.0
* Bug: (GUI) Fixed adding and editing records with `datetime` field
* Chore: Set minimal node version to 16
* Improvement: (GUI) Show currently running jobs in Background Jobs

## 4.17.5
* Feature: (GUI) Basic network log under `/network`
* Improvement: add new command `modules download`, bring back old syntax to `modules pull`

## 4.17.4
* Feature: (GUI) Ability to filter logs by string
* Bug: Fixed updating module version in `pos-cli modules install <module_name>` command

## 4.17.3
* Bug: Fix packing module files for `pos-cli modules push` command

## 4.17.2
* Feature: (LogsV2 Reports) Added a few built-in reports based on requests https://github.com/mdyd-dev/pos-cli/pull/572
* Bug: (GUI) Fixed parsing `null` values on the database table view for `boolean` type
* Improvement: (GUI) Editing `boolean` values not uses `<select>` instead of `textarea`
* Bug: Fixed exporting as zip instead of JSON
* Bug: Generate uniq filenames when deploying assets zip to s3

## 4.17.1
* Bug: (GUI) Fixed clearing `boolean` value saved as 'null' (string)
* Bug: (GUI) Fixed adding and editing JSONs with special characters, especially brackets

## 4.17.0
* Bug: (GUI) `0` (int) no longer outputs `null` in the database browser
* Improvement: (GUI) Make the record context menu stay open untill user clicks outside it

## 4.16.2
* Bug: Fix passing arguments to generator

## 4.16.1
* Chore: (GUI) Updated to SvelteKit 2 and Vite 5
* Chore: (GUI) Updated naming in GraphQL requests
* Feature: List and pass additional options to generators
* Feature: add `pos-cli generate list` command
* Improvement: allow to pull public modules files without env
* Improvement: modules push will pack all files

## 4.16.0
* Feature: (GUI) Added filtering by date to Logs v2
* Feature: (GUI) Added hover and active states to the table in Logs v2
* Feature: (GUI) Ability to reset sidebar width by double clicking the resize handle
* Feature: (GUI) Don't fetch logs for connection indicator and just use /info
* Feature: (GUI) Show instance link in the header and in the page title
* Feature: allow to pull public module files via `modules pull`

## 4.15.2
* Bug: Fixed running the GUI in custom port number

## 4.15.1
* Bug: Fix downloading module source with `modules pull`

## 4.15.0
* Chore: Updated Svelte dependencies
* Bug: Hardcoded links to GraphiQL and Liquid Evaluator in old GUI
* Feature: Ability to list and restore deleted records through the UI
* Feature: (PoC) Ability to search for given log timestamp and showing logs before and after it

## 4.14.4
* Improvement: allow to push modules with new directory structure `modules/<module_name>/public`
* Bug: Properly parse boolean values in GUI
* Bug: Fix adding env with `url` only

## 4.14.3
* Chore: New package build

## 4.14.2
* Bug: Fixed new logs response structure so /logsv2 would work for selected instances

## 4.14.1
* Bug: Fixed old GUI not being able to connect to the API

## 4.14.0
* Feature: Updated pos-cli gui interface with the 'Next' version, hidden the old pos-cli gui under localhost:3334

## 4.13.3
* Bug: Cleaned up Python and build tools dependencies that were blocking install on some configurations

## 4.13.2
* Chore: Recreated package-lock

## 4.13.1
* Bug: Fix `data import` request
* Bug: Fix `modules push` command

## 4.13.0
* Feature: Initial alpha implementation of new logs API

## 4.12.8
* Bug: fix adding env with `--email` option

## 4.12.7
* Bug: Fixed success message for `env add` command
* Bug: fix storing env in file

## 4.12.6

* Authorize adding new env with portal website when passing only `--url`

## 4.12.5
* Improvement: Improved UX of pagination in Next GUI
* Feature: add command `pos-cli modules install`

## 4.12.4
* Bug: graphql - fix error on deprecated types
* Improvement: graphql - update default query and mutation

## 4.12.3
* Bug: fix graphiql build

## 4.12.2
* Improvement: filter out deprecated queries and mutations in Graphiql
* Bug: Unhardcoded the API URL in new pos-cli GUI to enable using it on different ports

## 4.12.1
* Bring back schema explorer to the graphiql

## 4.12.0
* Added command for running generators from modules `pos-cli generate`
* Update graphiql
* Improvement: Accessibility improvements in pos-cli GUI
* Bug: Fixed pos-cli GUI crashing for fresh instances without logs
* Bug: Unhardcoded the API URL in new pos-cli GUI to enable using it on different ports

## 4.11.0
* Feature: Ability to sort the records
* Improvement: Pin icon on homescreen is now filled when the tool has been pinned for better UX
* Improvement: Added `arguments` section in the background job details panel
* Bug: Fixed showing `run_at` and `dead_at` dates in Background Jobs Manager
* Bug: Fixed not showing `undefined` when there is no URL for a background job
* Bug: Fixed app failure when using new background job syntax
* Bug: Fixed a problem with text overflow on Users details panel


### pos-cli gui next updates

## 4.10.0

### pos-cli gui next updates
* Added new tool - Background jobs manager
* Added ability to resize sidepanels
* New home screen design to fit more tools
* Ability to customize the header navigation by adding and removing the tool shortcuts
* Fixed hardcoded server port so multiple `pos-cli gui serve` can be run at once
* Users can now be filtered by uncomplete email string
* Fixed clearing filters and submitting form using keyboard when filtering Users
* Logs are now updated every 3 seconds
* The license changed to CC BY 3.0

## 4.9.2

### pos-cli gui next updates
* Reloading subpaths does not return 404 anymore
* More contrast on string-json toggle
* Inline validation when editing JSON type
* Enabled keyboard navigation for toggle switch in record edit form
* Fixes showing 'false' value for bool attributes
* Not clearing the filters after editing a record anymore
* Showing full values in parsed JSON logs
* Scrolling to bottom when new log appears and the page was scrolled to bottom before

## 4.9
* Add new `pos-cli gui serve` beta version at `localhost:3334`

## 4.8.1
* Fix `pos-cli sync` to not stop working when there were syntax in synced files

## 4.8.0
* use Liquid Evaluator as a title
* Fix fsevent os error
* Add `pos-cli modules init` command (initialize a module with the structure)
* Add `pos-cli modules version` command to create new version of the module
* Add `pos-cli modules push` command to publish new version fo the module

## 4.7.1
* Fix package-lock for graphql

## 4.7.0
* Fix error reporting in `pos-cli data import`
* `pos-cli data clean` runs async and waits for finish 

## 4.6.2
* Fix `--port` argument in `pos-cli gui serve`
* Add asset file size to manifest

## 4.6.1
* Add `--sync` to `pos-cli gui serve`. It will run gui and sync files in background.
* Fix deploy with custom `.pos` file location.

## 4.6.0 
* Fix logs

## 4.5.21
* Add `pos-cli constants`
* Escape HTML in `pos-cli gui` logs

### Usage

Add constant named `API_KEY` with value `abc123` on `dev` environment:

    pos-cli constants set --name API_KEY --value abc123 dev

Remove constant `API_KEY` on `staging` environment:

    pos-cli constants unset --name API_KEY staging

List defined constants without exposing their values on `production` environment:

    pos-cli constants list production

    SECRETTOKEN                                        "XX..."
    TEMP_TOKEN                                         "XX..."
    USE_SEARCH_INDEX                                   "tr..."

List defined constants showing their values on `production` environment:

    SAFE=1 pos-cli constants list production

    SECRETTOKEN                                        "XXXXXXX"
    TEMP_TOKEN                                         "XXXXXXXXXXXXXX"
    USE_SEARCH_INDEX                                   "true"

## 4.5.20
* Downgrade ora package

## 4.5.19
* Replace reporting tool
* Upgrade some npm dependencies

## 4.5.18

* Display more 99 constants in constants editor, instead of only 20

## 4.5.17

* Add `.br` and `.gz` extensions to synced files.  

## 4.5.16

* Add `pos-cli archive` command (creates a release archive without deployment)

## 4.5.15

* Do not include zip files in resources zip file (ie. `app/views/partials/Test.zip`). Zip files in assets remain intact

## 4.5.14

* Do not throw javascript error if internal waiting function rejects

## 4.5.13

* Add `.map` and `.pptx` extensions to `pos-cli sync`

## 4.5.12

#### `pos-cli gui serve` logs improvements
* Make filtering more prononunced
* Highlight filter phrase
* Make Prettified JSON full height so it is less scrolling confusion
* Add "Clear screen" button which clears all visible logs

## 4.5.11
* Add filtering of logs in `pos-cli gui serve`
* Add constants editor to `pos-cli gui serve` at `http://localhost:3333/Constants`

## 4.5.10
* Improve `pos-cli gui serve` logs behavior, layout, add pretty print

## 4.5.9
* Add logs to `pos-cli gui serve` at http://localhost:3333/Logs

## 4.5.5
* Add AVIF format to watch list

## 4.5.3
* Improve environment reporting

## 4.5.0
* Added new command `pos-cli uploads push` for uploading files for property of type `upload`

## 4.4.26
* Improve error message on wrong password when using `pos-cli env add`
* Fix `pos-cli sync` issue with `webpack` file generation, it will wait untill file is completly written.

## 4.4.25
* Deprecate `headers` in `api_calls` files in favour of `request_headers`
* Improve displaying errors on `import` and `deploy`
* Support `{% liquid %}` tag in `audit` command
* Add usage statistics

## 4.4.24 - pos-cli admin users
* Added list of users to admin (phase 1)
* Redesign of admin models list

## 4.4.22 - Init wizard
* Added `--wizard` (-w) to `pos-cli init` with choice between different templates

## 4.4.21 - 15 July 2020 - Admin improvements
* Correctly display arrays in fields
* Show `text` fields as textarea
* Fix updating `text` fields
* Add string filters to text fields
* Correctly display values in quotes, square brackets, etc. in edit view
* Improve example hints for filtering
* Improve placeholders for new records
* Improve placeholder for editing records
* Improve displaying of text, array and upload fields

## 4.4.18 - 14 July 2020
* Update GraphiQL to 1.x

## 4.4.16 - 14 July 2020
* Added platformOS Admin reached on [localhost:3333](http://localhost:3333) after running `pos-cli gui serve`
* Changed `-o` in `pos-cli gui serve` to open Admin instead of GraphiQL

## 4.4.14 - 25 May 2020
* Added liquid evaluator page in `pos-cli gui serve`

## 4.4.13 - 11 May 2020
* Fixed node.js v14 warnings

## 4.4.12 - 8 May 2020
* Added `'` and `&` as valid filename characters
* Added `-c` alias for `--concurrency` in `pos-cli sync`

## 4.5.0@beta - 8 April 2020
* `pos-cli deploy` will directly upload assets to S3 by default

## 4.4.11 - 8 April 2020
* Improved error message environment URL is not recognized, or there is no internet connection
* Added `--include-schema` (`-i`) to `pos-cli data clean`. It will additionally remove all admin resources pages, schemas, graphql queries, notifications. It will not clear instance constants or anything set up in Partner Portal

## 4.4.10 - 6 April 2020
* Fixed `pos-cli audit` - now auditing files only in `app` and `modules` directories
* Added `@` and `%` to valid `pos-cli sync` characters

## 4.4.9 - 31 March 2020
* Fixed `pos-cli deploy -d` assets manifest creation on Windows
* `pos-cli init` is now using `--force` by default
* Fixed `pos-cli audit` for graphql audit when checking multiline tag

## 4.4.8 - 26 March 2020
* `pos-cli audit` will not report filenames with characters `+ ( )` as invalid

## 4.4.7 - 26 March 2020
* Fixed regression in `sync` not syncing anymore after couple files synced

## 4.4.6 - 26 March 2020
* Fixed regression when no `--livereload` was used in `sync`

## 4.4.5 - 25 March 2020
* Added `--livereload` (`-o`) flag to `pos-cli sync` which starts livereload server to refresh browsers automatically on file change. Requires installed livereload browser extension to work

## 4.4.4 - 23 March 2020
* Added `--open` (`-o`) flag to `pos-cli gui serve` and `pos-cli sync`. It opens respectively GraphiQL and instance in default browser when ready
* Fixed windows audit for invalid file paths

## 4.4.0 - 20 March 2020
* Added `pos-cli modules pull <environment> <module name>` command. It works similar to `pos-cli pull`, but pulls only given module files. Use `pos-cli modules pull --help` to read help
* Improve messaging of wrong file types
* Added `pos-cli audit` warnings for files with invalid characters in their name
* Added `pos-cli sync` check for invalid characters in file path - invalid files will not be synced

## 4.3.0 - 18 March 2020
* `pos-cli pull` command has been added. It pulls compressed resources (pages, notifications, forms, graphql files etc.) from given environment. It pulls only files from `app/` directory. Use `pos-cli pull --help` to read help
* `pos-cli sync` is now deleting files, if file was removed while sync running
* `pos-cli audit` is now warning about wrong file types in some directories

## 4.2.5 - 25 February 2020
* Added `mp3`, `mp4`, `webm` and `ogg`, extensions to `pos-cli sync` watch list
* Added `--direct-assets-upload` (`-d`) option to `pos-cli sync` command for faster
  assets syncing

## 4.2.4 - 5 February 2020
* `pos-cli logs` now prints info about request path and partial when available
* `pos-cli migrations list` list migrations in order of execution
* Fixed `pos-cli deploy` command with `-d` option for direct assets upload

## 4.2.3 - 20 December 2019
* `pos-cli gui serve` now remembers last used query between page reloads
* `pos-cli gui serve` GraphiQL explorer will not show deprecated queries/mutations

## 4.2.2 - 19 December 2019
* Fix prettify and history features in `pos-cli gui serve`

## 4.2.1 - 19 December 2019
* Add filter to `pos-cli logs` that allows to display only given log type
* Fixed git submodules in modules/
* Add graphiql explorer to `pos-cli gui serve`

## 4.1.19 - 5 December 2019
* .zip files are now correctly synced

## 4.1.18 - 29 November 2019
* Upgrade GraphiQL to 0.17.0

## 4.1.17 - 4 November 2019
* Add support for `.posignore` file which works the same way as `.gitignore` for git
* Do not include modules assets using `pos-cli deploy` with `--direct-assets-upload` flag
* Fix packing and uploading assets when using `pos-cli deploy` with `--direct-assets-upload` flag

## 4.1.16 - 16 October 2019
* Fix error when there is no environments to list using `pos-cli env list`
* Fix spelling issue in `pos-cli data clean` message

## 4.1.15 - 1 October 2019
* Use `bundledDependencies` to prevent conflicts with globally installed npm packages

## 4.1.14 - 30 September 2019
* Send false in `partialDeploy` when deploying module

## 4.1.13 - 30 September 2019
* Fix rare case when dependency conflict between local and global packages

## 4.1.12 - 27 September 2019
* Revert commander.js version to ^2

## 4.1.10 -  27 August 2019
* Improved error handling when migration doesn't exist on the server
* Added support for Windows

## 4.1.9 - 22 August 2019
* Fixed paths to all binaries required in `pos-cli deploy` win32 + PowerShell

## 4.1.8 - 21 August 2019
* Fixed spawning audit command in `pos-cli deploy` win32 + PowerShell
* Handle deploy errors better

## 4.1.7 - 15 August 2019
* Fix syncing module files on win32 + PowerShell

## 4.1.3 - 12 August 2019
* Do not use colors or notifier when `CI=true`
* Added 413 `Entity too large` server error support
* Added MIT License
* Improved displaying errors
* Added `--force` option to `pos-cli init`

## 4.1.2 - 31 July 2019
* Fixed some server errors not showing up in `pos-cli deploy`
* Fixed `--direct-assets-upload` modules assets deploy

## 4.1.1 - 30 July, 2019
* Fixed cut off messages in notifier

## 4.1.0 - 30 July, 2019
* Improved performance of repetitive http requests (sync, logs, deploy status etc.) by using `keepAlive`
* Fixed CI environment variable support in audit
* Censored token in `DEBUG=true` mode to prevent accidental leaks
* Improved error message when there is syntax error in config file
* Improved server error handling and messages
* Switched from `glob` to `tiny-glob`
* Switched from `node-watch` to `chokidar`
* `pos-cli sync` is syncing newly created files
* `pos-cli sync` is syncing `template-values.json` files inside module directory

## 4.0.4 - 26 July, 2019
* Added audit rule for unnecessary brackets after field name
* Fixed audit bug where files deeply nested were not checked
* Added more useful information when JSON file is invalid (ie. your main config)
* `pos-cli sync` will not stop if `template-values.json` is invalid JSON
* Improved error handling for templates exception
* Improved error messages returned by the server

## 4.0.3 - 25 July, 2019
* Init is now not overriding files in current directory. Added `--force` flag to override
* Added sentry for error reporting
* Improved displaying server errors
* Added platformOS logo to sync/logs errors notifications on OS other than macOS

## 4.0.2 - 24 July, 2019
* Hotfixed deploy with modules

## 4.0.1 - 24 July, 2019
* Updated all npm dependencies
* Fixed partial deploy (`-p`) and tightened checks for app and module directories
* Fixed deploy on windows
* Fixed E2BIG error when server error/log is very big

## 4.0.0 - July 22, 2019
* 💥 BREAKING 💥 Removed `--config-file` option from all commands. `CONFIG_FILE_PATH` environment variable is working as previously
* Renamed `.marketplace-kit` file to `.pos`. To not break existing processes, `pos-cli` is looking for `.marketplace-kit` as well. This fallback will be removed in the next major version release
* Improved audit performance (by ~55x)

## 3.0.8 - July 16, 2019
* Improved messaging when using `--direct-assets-upload` in `pos-cli deploy`
* Improved help message when command is not found or argument is missing

## 3.0.7 - July 11, 2019
* Fixed `--direct-assets-upload` in `pos-cli deploy`
* Added `--concurrency` (`-c`) option to `pos-cli sync`

## 3.0.6 - July 9, 2019
* Migrated `pos-cli init` implementation to use `degit`

## 3.0.5 - July 9, 2019
* Improve error message when `pos-cli gui serve` cannot start server on a given port

## 3.0.4 - July 9, 2019
* Fixed `pos-cli gui serve`

## 3.0.0 - July 7, 2019
* Renamed `-V` flag to `-v` for version check
* Deprecated `-f` flag on `pos-cli deploy`
* Added support for `CI` environment variable. If set to `true`, `audit` will be skipped during deploy
* Added running `pos-cli audit` on deploy
* Upgraded minium supported version of node.js to 10
