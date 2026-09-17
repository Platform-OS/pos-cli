---
id: TASK-13
title: >-
  MCP tool surface: launch-time profiles, --include-tools/--exclude-tools, and
  one job-status tool for async operations
status: In Progress
assignee: []
created_date: '2026-09-17 06:29'
updated_date: '2026-09-17 13:11'
labels:
  - mcp
  - enhancement
dependencies:
  - TASK-14
  - TASK-6
references:
  - mcp-min/tools.js
  - mcp-min/tools.config.json
  - mcp-min/stdio-server.js
  - mcp-min/http-server.js
  - mcp-min/auth.js
  - mcp-min/deploy/start.js
  - mcp-min/deploy/status.js
  - mcp-min/deploy/wait.js
  - mcp-min/data/import-status.js
  - mcp-min/data/export-status.js
  - mcp-min/data/clean-status.js
  - mcp-min/tests/run-async-result.js
  - bin/pos-cli-mcp.js
  - bin/pos-cli-mcp-config.js
  - lib/ai.js
  - lib/push.js
  - lib/deploy/directAssetsUploadStrategy.js
  - lib/deploy/waitForAssetReport.js
  - lib/data/waitForStatus.js
documentation:
  - 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools'
  - 'https://modelcontextprotocol.io/extensions/tasks/overview'
  - 'https://modelcontextprotocol.io/extensions/client-matrix'
  - CLAUDE.md#input-validation-ajv
priority: high
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the default pos-cli MCP setup for a coding agent costs about a third of today's tool-definition bytes. Teams can trim or extend the exposed set without code changes. Every async operation is polled through one tool whose status cannot report a running job as finished.

## Measured baseline (2026-09-17, commit 0555c23, `tools/list` over stdio)
- 35 tools registered in `mcp-min/tools.js`, 34 exposed (`check` is disabled in `mcp-min/tools.config.json`). Payload: 24,612 bytes.
- Largest: data-import 1,379 · sync-file 1,247 · liquid-exec 1,204 · graphql-exec 1,108 · data-validate 1,068.
- Agent-loop set (check-run, logs-fetch, liquid-exec, graphql-exec, envs-list, deploy-start, deploy-status, deploy-wait, unit-tests-run, tests-run-async, tests-run-async-result): 8,234 bytes, which is 66.5% less.
- The `env` + `url`/`email`/`token` properties repeated across 25 tools take 9,038 bytes (37%). Not addressed here.

## Part 1: choose the exposed tools at launch
One pure resolver, shared by the server and `pos-cli-mcp-config`:
```
base     = tools of --profile            (default: full)
selected = (base ∪ --include-tools) − --exclude-tools
exposed  = selected − tools disabled by the tools config
```
Decisions:
- Built-in profiles live in code, not in tools.config.json.
  - `full` is computed as every registered tool, so a new tool reaches `full` automatically and has to be added to `dev` on purpose.
  - `dev` is an explicit list (the agent-loop set above).
  - `none` is empty, so a pure allowlist can be written as `--profile none --include-tools a,b`.
  - The report called the full set `admin`. `full` is clearer: `admin` sounds like operator-only tools, which would be the complement of `dev`.
- `--include-tools` adds to the profile. Gemini CLI's client-side `includeTools` is an allowlist instead, so the docs must say this.
- Bare `pos-cli-mcp` keeps exposing `full` in 6.x. When tools vanish from an agent's view, nothing reports an error, so changing the default would silently break anyone who uses data, portal or migration tools. `pos-cli ai init` writes `--profile dev`, which is how new users get the saving. The default switches to `dev` at the next major. **A maintainer may want to reverse this call.**
- Fail closed, like the tools config (CLAUDE.md "The tools config fails closed"). Each of these is a startup error before any transport starts:
  - an unknown profile
  - an unknown tool name in either flag
  - the same name in both flags
  - `--include-tools` naming a tool the tools config disables (it would otherwise do nothing, silently)
  - an empty exposed set
  
  Name lookups check own properties only (see `loadToolsConfig` and TASK-5). Excluding a tool that is not in the base set is allowed, so one exclude list can serve every profile.
- The selection is fixed for the life of the process and the same for every client and both transports. MCP 2026-07-28 says `tools/list` "MUST NOT vary per-connection" and "SHOULD return tools in a deterministic order". So there is no per-request selection, and tools are listed in registry order.
- A tool that is not exposed cannot be called, not just hidden from the list. All five dispatch paths (stdio `tools/call`, stdio direct method, HTTP `/call`, `/call-stream`, JSON-RPC `tools/call`) answer tool-not-found. The HTTP transport has no authentication (TASK-16 restricts it to loopback but adds no auth), so a tool that is hidden but still callable would make profiles cosmetic.
- A tool's description must not name a tool that is missing from the same profile. Today: tests-run-async names tests-run-async-result, and instance-create names partners-list and endpoints-list.
- `pos-cli ai init` overwrites any entry that differs from its template (`lib/ai.js` `configureTool`). Once `args` hold user choices, that would wipe customisations. It should upgrade only an entry equal to a previous canonical form, and keep and report a customised one.

## Part 2: one `job-status` tool
Five starters share six status tools: deploy-status, deploy-wait, data-import-status, data-export-status, data-clean-status and tests-run-async-result. `job-status` replaces them. Verified defects that must be fixed, not carried over:
1. **deploy-wait reports success in the middle of a deploy.** It keeps polling only on `ready_for_import`, but the API also returns `in_progress` (`lib/push.js` polls on both). Reproduction: a fake Gateway returning `ready_for_import, in_progress, …, success` makes it return `ok:true, status:in_progress` after 2 polls.
2. **It can silently query the wrong instance.** `env` is optional, and an omitted `env` resolves to the first `.pos` entry (`mcp-min/auth.js`). A deploy started with `env: staging` and polled without `env` asks another instance about the same numeric id, and can return an unrelated deployment's status.
3. **It sends the token to a host chosen by an argument.** deploy-status and deploy-wait accept `endpoint`, which replaces the request URL while the `.pos` token is still sent.
4. **"Done" ignores assets.** deploy-start uploads assets in the background without `releaseId` (the CLI passes it, see `lib/deploy/directAssetsUploadStrategy.js`). So the server never reports an asset phase for MCP deploys, and nothing tells the agent that assets are still uploading.

Decisions:
- Starters also return `job_id`: a handle the server mints, versioned and self-contained, encoding the kind, remote id, instance origin and kind-specific flags (the export's zip flag).
  - It is not a key into an in-memory table, even though the spec's non-normative "Stateful Tools" section prefers opaque handles. Clients restart stdio servers while the agent keeps its context, so with a table every restart would turn into "unknown job".
  - Safeguards: a strict parser; credentials and the request URL never come from the handle; the tool description says to pass the handle back unchanged.
- `job-status` resolves auth like every other tool. If the resolved origin differs from the handle's, it returns a tool execution error without calling the instance, so defect 2 becomes a visible error.
- One result shape for every kind, with `state: running | completed | failed`.
  - `completed` means the operation finished, even when the result reports failed tests.
  - `failed` means the operation itself failed.
  - This matches the Tasks extension's working/completed/failed.
- An optional, bounded `wait_ms` replaces deploy-wait, whose loop has no deadline unless `maxWaitMs` is given. Hitting the deadline returns `done:false`, not an error.
- The deprecated tools:
  - stay in `full` for 6.x and never appear in `dev`
  - run on the same adapters, so defect 1 is fixed in them too
  - are removed at the next major. Removal breaks config files and flags that name them (fail closed), and the CHANGELOG must say so then.
- MCP 2026-07-28 moved Tasks into the `io.modelcontextprotocol/tasks` extension, and no client in the official extension matrix supports it (checked 2026-09-17). Passing a handle as an ordinary tool argument is the pattern the spec itself describes. Keep the adapters independent of the transport so they can later be exposed as Tasks; that exposure is a non-goal here.

## Sequencing
Part 1 and Part 2 are separate PRs, Part 1 first.
- Depends on TASK-14 (the `pos-cli mcp` invocation task), which adds the argument parser in `bin/pos-cli-mcp.js`.
- Depends on TASK-6: the resolver belongs in its shared loader.
- Coordinate with TASK-5 (dispatch guard) and with TASK-15 (SDK v2 / 2026-07-28). Transports receive the resolved registry, and whichever task lands second adapts.

Non-goals: shrinking the shared auth properties, tool annotations (TASK-15), HTTP binding and Host/Origin validation (TASK-16), and the Tasks extension.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `pos-cli-mcp --profile dev` exposes exactly the documented dev set in registry order on stdio tools/list, JSON-RPC tools/list and GET /tools; a test pins the set and a byte budget for its tools/list payload
- [x] #2 Bare `pos-cli-mcp` exposes the same tools as before this change (full profile), verified by a test
- [x] #3 `--profile none --include-tools a,b` exposes exactly a and b; `--include-tools` adds to any profile; `--exclude-tools` removes; comma-separated and repeated flags are equivalent
- [x] #4 Startup exits non-zero with one stderr message and no transport started for: unknown profile, unknown tool name in either flag, a name in both flags, including a tool disabled by the tools config, an empty exposed set; prototype names such as `constructor` count as unknown
- [x] #5 A tool that is not exposed is answered as tool-not-found on all five dispatch paths, with a test per path
- [x] #6 `pos-cli-mcp-config` accepts the same three flags and lists exactly what the server exposes for them, including the same failures
- [x] #7 No exposed tool description names a tool that is not exposed in the same built-in profile; a test enforces this for every built-in profile
- [x] #8 `pos-cli ai init` writes the dev profile for Claude Code, Cursor and VS Code, upgrades an entry equal to a previous canonical form, leaves a customised entry untouched and reports it, and remains a no-op on re-run
- [ ] #9 deploy-start, data-import, data-export, data-clean and tests-run-async return a `job_id` in addition to their current fields, and `job-status` accepts it
- [ ] #10 `job-status` returns one normalised shape for all five kinds with state running/completed/failed per the documented mapping; tests cover every known remote status of every kind, including deploy `in_progress` as running, and an unknown status
- [ ] #11 `job-status` returns a tool execution error without contacting the instance when the job_id is malformed or when the resolved instance differs from the one the job was started on
- [ ] #12 A job_id minted by one server process is accepted by a new process, and credentials and request URL never come from the job_id (a forged origin yields a mismatch error and no outbound request)
- [ ] #13 `wait_ms` (max 120000) polls until a terminal state or the deadline; the deadline returns done:false rather than an error; progress notifications are sent when the client supplied a progress token; cancellation stops polling
- [ ] #14 A deploy job is done only when the release is terminal and asset processing started by this server has finished or failed; the asset phase is reported, as `unknown` when it cannot be observed (e.g. after a restart)
- [ ] #15 deploy-status and deploy-wait reject an `endpoint` argument
- [ ] #16 The six replaced status tools remain in `full`, are marked deprecated in their descriptions, run on the job-status adapters (deploy-wait no longer returns while `in_progress`), and are absent from `dev`
- [ ] #17 README MCP section, docs/MCP_TOOLS.md, CLAUDE.md MCP section and CHANGELOG document profiles, flag semantics including the difference from Gemini includeTools, the default-profile decision, job-status, the removed `endpoint` argument and the deprecations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Related: TASK-14 is the invocation task that owns the argument parser. TASK-15 is the SDK v2 / 2026-07-28 transport task. TASK-6 is the shared tools.config loader. TASK-5 is the dispatch lookup guard.

## Part 1 (PR 1): selection
1. `mcp-min/tools.js`:
   - Export the ordered registry with no import-time config side effect.
   - Add `resolveTools({ profile = 'full', include = [], exclude = [], config })`, returning `{ tools, profile, include, exclude }` or throwing `ToolsConfigError`.
   - Build the returned registry without prototype-chain lookups: a null-prototype object or a Map (align with TASK-5).
   - Update tests that import the default export to call the resolver.
2. `mcp-min/profiles.js`: `full` is computed from the registry; `dev` is an explicit ordered list (check-run, logs-fetch, liquid-exec, graphql-exec, envs-list, deploy-start, deploy-status, deploy-wait, unit-tests-run, tests-run-async, tests-run-async-result); `none` is `[]`. The exposed order is always registry order, never profile-list order.
3. The resolver implements `(base ∪ include) − exclude − config-disabled` and every fail-closed rule from the description. Messages name the offending names and the config path; unknown names list close matches.
4. Transports take the registry as input:
   - `mcp-min/index.js` exports `start({ tools, port })`.
   - `startStdio({ tools })` and `startHttp({ port, tools })` stop importing the module singleton.
   - The direct-run path in `stdio-server.js` resolves with defaults.
5. `bin/pos-cli-mcp.js`:
   - Add `--profile <name>`, `--include-tools <list...>` and `--exclude-tools <list...>`, using a commander collector that splits on commas, trims, and rejects empty entries.
   - Resolve before importing the transports; on `ToolsConfigError`, log through the logger and exit 1.
   - Log the startup line (profile, include, exclude, exposed count) through `mcp-min/log.js`, which writes to stderr and the log file.
6. `bin/pos-cli-mcp-config.js`: same flags through the shared resolver and TASK-6's loader. Output shows the profile, flags, exposed tools, and the hidden tools with the reason each is hidden (profile / excluded / config-disabled).
7. `lib/ai.js`:
   - The platformos entry becomes `{ command: 'pos-cli-mcp', args: ['--profile', 'dev'] }`; VS Code keeps `type: 'stdio'`.
   - Add a list of previous canonical forms (`{ command: 'pos-cli-mcp' }`, with the VS Code `type` variant).
   - An entry equal to a previous canonical form is upgraded; a different entry is kept and reported as customised; an entry equal to the current form is a no-op.
   - Update `test/unit/ai.test.js` and `test/integration/ai.test.js`.
8. Tests:
   - table-driven resolver tests: every rule, including prototype names, a duplicate name across flags, and an include of a config-disabled tool
   - dispatch tests: an unexposed tool is not-found on each of the 5 paths
   - description cross-reference test over every built-in profile: every registered tool name found in a description must be exposed in that profile
   - byte-budget test: stdio tools/list for `dev` stays ≤ the recorded value rounded up to the next 250 bytes, so growth needs a deliberate bump
   - bare-invocation parity test against the pre-change tool list
9. Docs: README, docs/MCP_TOOLS.md, CLAUDE.md MCP section, CHANGELOG.

## Part 2 (PR 2): job-status
1. `mcp-min/jobs/handle.js`:
   - `mint({ kind, id, origin, flags })` returns `pjob1_` + base64url(JSON).
   - `parse(jobId)` validates:
     - the prefix
     - that the JSON parses
     - `kind` ∈ {deploy, data-import, data-export, data-clean, test-run}
     - `id` matches `^[A-Za-z0-9_-]{1,128}$`
     - `origin` satisfies `new URL(origin).origin === origin` with an http or https protocol
     - flags against a per-kind allowlist (data-export: `zip` boolean)
   - Anything else is `INVALID_JOB_ID`.
2. Adapters in `mcp-min/jobs/adapters/*.js`, each `poll(deps, remoteId, flags)` returning `{ state, status, result?, error?, assets? }`:
   - **deploy** (`Gateway.getStatus`):
     - `ready_for_import`, `in_progress` → running
     - `error` → failed; the message is `error.error` plus `details.file_path`, and warnings are passed through (as in `lib/push.js`)
     - anything else → completed
     - Asset phase comes from, in order: a local record (`uploading`/`failed`) kept by `mcp-min/jobs/local-phases.js` for uploads this process started; then the server fields `asset_status: in_progress` → processing, `asset_report` → done, `asset_error` → failed; otherwise `none` if this process started no upload for the job, else `unknown`.
     - `done` = release terminal and asset phase not in {uploading, processing}.
   - **data-import** (`dataImportStatus(id, true)`), **data-export** (`dataExportStatus(id, zip)`) and **data-clean** (`dataCleanStatus(id)`):
     - status = `status.name || status`
     - pending/processing/scheduled → running; done → completed; failed → failed
     - any other status → running, with the raw status echoed and logged
     - data-export's completed result is `zipFileUrl` or `exportedData`, shaped as `mcp-min/data/export-status.js` builds it today
   - **test-run** (`GET {url}/_tests/results/:id` with the same headers as `tests/run-async-result.js`):
     - pending → running
     - success → completed with passed:true
     - failed → completed with passed:false, including totals and tests
     - error → failed
     - `{error:'not_found'}` → JOB_NOT_FOUND
   - **Every kind:** HTTP 404 → `JOB_NOT_FOUND`, returned as a tool execution error.
3. Starters return `job_id` alongside their existing fields. The origin comes from `new URL(auth.url).origin`.
4. deploy-start assets:
   - Register the background asset promise in `local-phases` under origin + release id.
   - Pass `releaseId` to `deployAssets`.
   - **Before merging, verify against a real instance** whether `sendManifest(manifest, releaseId)` is accepted while the release is `ready_for_import` or `in_progress`. If it is not, the background task first waits for the release to reach a terminal state, as the CLI does. Record the result in the PR.
5. `job-status`:
   - Closed schema: `{ job_id (required), wait_ms: integer 0..120000, env, ...authProperties }`.
   - Flow: `resolveAuth` → compare origins (`JOB_INSTANCE_MISMATCH` names both hosts and makes no request) → poll.
   - With `wait_ms`, keep polling with backoff (1 s base, 5 s cap, as `lib/deploy/waitForAssetReport.js` does) until done or the deadline.
   - Send `ctx.sendProgress` when present. Honour an AbortSignal when the transport provides one (TASK-15).
   - The description says the job_id is opaque and must be passed back unchanged.
6. Deprecated tools:
   - delegate to the adapters and keep their current output fields
   - descriptions start with "Deprecated: use job-status."
   - `endpoint` is removed from the deploy-status and deploy-wait schemas, so the closed schema rejects it; add a CHANGELOG security note
   - deploy-wait keeps `intervalMs` and `maxWaitMs` for compatibility, implemented on the adapter
7. Profiles: add `job-status` to `dev`; remove deploy-status, deploy-wait and tests-run-async-result from `dev`.
8. Tests:
   - handle round-trip; malformed and forged handles
   - adapter mapping table per kind, including unknown statuses and 404
   - origin mismatch makes no outbound request (fake Gateway or request function asserts it was not called)
   - wait deadline returns done:false
   - progress notifications are emitted
   - the deprecated deploy-wait no longer returns on `in_progress`
   - a job_id minted in one spawned process is accepted by a new one
   - asset-phase states, including `unknown` after a restart
9. Docs and CHANGELOG, including the removal note planned for the next major and its effect on tools config files and flags.

Repro used when filing:
- **Sizes:** spawn `bin/pos-cli-mcp.js`, send `tools/list`, measure `Buffer.byteLength(JSON.stringify(result.tools))` in total, per tool, and for the dev subset.
- **deploy-wait defect:** `(await import('mcp-min/deploy/wait.js')).default.handler({ id:'1', url:'https://x.example.com', email:'a@b.c', token:'t', intervalMs:200 }, { Gateway: class { async getStatus(){ return seq[Math.min(calls++,3)]; } } })` with seq `[ready_for_import, in_progress, in_progress, success]` returns ok:true with data `{status:'in_progress'}` after 2 polls.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Part 1 implemented (2026-09-17): structure and deviations from the plan
- **Modules.** `tools.js` is only the registry: a `Map` in client order with no import-time config. `profiles.js` holds full (computed), dev (list) and none. `tools-config.js` is TASK-6's loader and the only reader of the config (`loadToolsConfig`, `isDisabledByConfig`, `configuredTool`). `tool-selection.js` has `resolveTools` (pure), `selectTools` (load + resolve), `findTool` and `describeSelection`. `cli-args.js` exports `addToolSelectionOptions`/`selectionFrom`, used by both bins.
- **Startup order.** `bin/pos-cli-mcp.js` runs parse, then `selectTools`, then `start({ selection })` from `index.js`. Importing index.js starts nothing now. `HttpConfigError` is still thrown before any transport starts.
- **Deviation: transports require `tools`.** `startStdio({ tools })` and `startHttp({ tools })` throw a TypeError unless given a Map; there is no default. A default of the full registry would re-open the fail-open that profiles close.
- **Deviation: `start({ selection })` instead of `start({ tools, port })`.** The port stays in `MCP_MIN_PORT`/readHttpConfig; the selection also carries profile, include and exclude for the startup log line.
- **Resolver rules beyond the plan.**
  - A repeated `--profile` and empty list entries are syntax errors (commander).
  - Duplicate names within one flag are collapsed.
  - Close matches use Levenshtein ≤ 2, up to 3.
  - Checks run in a fixed order: profile, names, overlap, disabled include, empty.
  - A hidden tool's reason is the first that applies: profile, then excluded, then disabled.
- **Config fallback.** A missing, unreadable or unparseable config still falls back to defaults (the documented rule). The server now logs a warning when `MCP_TOOLS_CONFIG` named the file, and `mcp-config` shows the state. Before, mcp-config exited 1 on a missing or unparseable file while the server ignored it.
- **mcp-config output.** Text shows Exposed and Not exposed (with a reason for each). **`--json` is now that report** (`config`, `profile`, `include`, `exclude`, `exposed`, `hidden`) instead of the raw file, recorded in the CHANGELOG as a behaviour change.
- **`lib/ai.js`.** The rule applies to both servers: add a missing entry; skip one deep-equal to the current form (key order ignored); upgrade one equal to a `PREVIOUS_SERVERS` form; keep and warn about anything else. Customised supervisor entries used to be overwritten too. **TASK-15 must add `{ command: 'pos-cli-mcp', args: ['--profile','dev'] }` to `PREVIOUS_SERVERS.platformos` when it adds `--no-http`.**
- **AC #7 check.** It scans each exposed tool's description and inputSchema text. Only hyphenated names count as references: `check`, the only single-word tool, appears as an English word in check-run's schema, and a test pins that it is the only one. No description changes were needed: instance-create names partners-list and endpoints-list, but it is not in dev.
- **TASK-5 fixed here.** All 5 dispatch paths use `findTool`, and the stdio dispatcher uses `Object.hasOwn`.
- **Cost.** `pos-cli mcp-config` now loads the tool registry: about 1.1 s instead of about 0.1 s, the same load the server does.
- **Compatibility.** A project config with `--profile dev` gets the full set on pos-cli ≤ 6.5.1, which ignores argv (documented). A release that has TASK-14's strict parser without these flags would refuse to start; both are unreleased on this branch, so ship them together.
- **AC #17** is done for Part 1 (profiles, flag semantics incl. the Gemini difference, the default-profile decision). Part 2 still has to document job-status, the endpoint removal and the deprecations.

## Part 1 verification (2026-09-17)
- **Baseline before any change** (spawned `pos-cli-mcp`, all three list paths): 34 tools, stdio tools/list 24,612 bytes. After the change, bare output is byte-identical on stdio tools/list, JSON-RPC tools/list and GET /tools. `--profile dev`: 11 tools in registry order, 8,234 bytes (budget pinned at 8,250).
- **New tests.**
  - `tool-selection.test.js` (51): every rule, prototype names in every position, profiles, bare parity, AC #7 cross-references, findTool.
  - `tool-surface.test.js` (72, spawned): all 3 list paths; `pos-cli mcp` passthrough; `mcp-config --json` equals the server's list; 7 refusals with the exact message, exit 1, nothing started, and mcp-config giving the same message; not-found on 6 dispatch variants × 6 hidden/prototype names with positive controls; the stdio dispatcher answering prototype methods; transports refusing to start without a Map.
  - `cli-args` (+9); `tools-config-validation` rewritten in-process plus both callers spawned (invalid / valid override / missing, and the server starting with a missing named config); `test/unit/ai.test.js` (+8); integration ai test asserts the whole entry.
- **Ported, not deleted:** validate-params, http, sse, list-envs, http-shutdown, http-exposure (still 79; the non-array allowlist test now asserts the exact TypeError, since a missing-tools TypeError would have satisfied the old check), transport-validation, and cli-invocation's stuck server.
- **Suite results.** mcp-min: 42 files, 802 tests green on Node 25. Node 22.23.2: mcp-min + ai unit + ai integration, 44 files, 822 green.
- **Bite against the committed code (ba12cd2).**
  - `tool-surface`: 21 fail and 47 are skipped, because the server cannot start with the flags.
  - TASK-5 variant on the old server with every tool exposed: 25 fail, 10 pass. Prototype names get past the lookup on 5 of 6 dispatch variants, and 5 prototype methods get no response. The passes are the controls and the already-guarded JSON-RPC tools/call.
  - `ai.test.js`: 13 of 16 fail.
- **Mutation testing.**
  - 54 mutants across transports, index, bins, parser, resolver, profiles and loader. First run: 51 killed of 53. S6 (startStdio defaulting to the registry) survived, so tests were added that both transports refuse a missing or plain-object `tools`; S6 and the added H7 (the same for startHttp) are killed on rerun. T13 (findTool without the string guard) is equivalent, because Map keys are all strings.
  - `lib/ai.js`: 9 mutants, 8 killed. AI9 (`Object.hasOwn` on the fixed server names) is equivalent, so the code was simplified to a plain lookup.
  - Every mutated file was restored and sha-verified.
- **Full repo against a clean-HEAD worktree: no new failures.** The one extra, `test/unit/lib/commands.test.js > should run env list`, is a pre-existing race with `mcp-min/__tests__/http.test.js`/`sse.test.js`, which write `.pos` into the repo root; running those three together fails 5/5 on clean HEAD too. The generators tests only fail in the worktree, which lacks fixture installs.
- **Side effects cleaned up.** `test/fixtures/yeoman/custom/package-lock.json` was rewritten by the generators test (reverted), and a fixture `.pos` was left in the repo root by the race runs (removed).
<!-- SECTION:NOTES:END -->
