# MCP coverage of the pos-cli surface

Which pos-cli capabilities the MCP server exposes, and — for the ones it does not — whether that
was a decision or an omission. Written because the tools were each added against the CLI as it
stood at the time, and nobody had compared the two surfaces since.

`mcp-min/__tests__/cli-coverage.test.js` enforces this file. It walks `bin/` the way commander
does, and fails if a capability is missing a row, if a row names a capability that no longer
exists, if an `exposed` row names a tool the registry does not have, or if an `expose` row names a
task that is not in the backlog. **A new CLI command therefore fails a test until someone records
what it means for the agent surface**, which is the only part of this document that cannot rot.

The decisions:

- **exposed** — an MCP tool covers it today.
- **expose** — it should be exposed; a task tracks it.
- **later** — not now, with a reason that says what would change the answer.
- **never** — unsuitable for an agent, with a reason.

Every tool added costs tokens on every request for every agent, which is the budget
`mcp-min/instructions.js` and the byte pins in `tool-surface.test.js` exist to defend. "Expose
everything" is not the goal and never was.

For anything marked **expose** or **later**, the four questions that scope it: does it need
credentials (so it inherits the `env` rule in CLAUDE.md), does it write to the developer's working
tree, is it destructive, and is it long-running enough to need the `job_id` / `job-status` pattern
rather than a synchronous answer.

## Decisions

| Capability | Decision | Tool / task | Reason |
|---|---|---|---|
| `ai init` | never | — | Registers MCP servers into AI-tool configuration files. Circular for this server to offer, and it edits files outside the project. |
| `archive` | later | — | Builds a release zip on disk. `deploy-start` already builds one internally; an agent has no use for the artifact itself. |
| `audit` | later | — | Largely superseded: `check-run` ships 54 rules including `DeprecatedTag` and `DeprecatedFilter`, two of audit's seven. A second linter that can disagree with the first is worse than neither. Its unique rules (unused partials, duplicate files, naming conventions) belong in platformos-check, not in a second tool. |
| `check run` | exposed | `check-run` | |
| `check init` | later | — | Writes `.platformos-check.yml`, whose bulk is a commented settings reference for a human to tune. `check-run` runs without it. |
| `check update-docs` | later | — | One-off maintenance download of the linter's Liquid documentation. Not part of any task an agent is asked to do. |
| `clone init` | never | — | Clones an entire instance into another. Minutes-long, operational, and the blast radius of a wrong target is the whole target instance. |
| `constants set` | exposed | `constants-set` | |
| `constants unset` | exposed | `constants-unset` | |
| `constants list` | exposed | `constants-list` | |
| `data export` | exposed | `data-export` | |
| `data import` | exposed | `data-import` | |
| `data update` | later | — | Blocked, not declined: a real gap in the data family, but the CLI itself ends with "Update scheduled. Check pos-cli logs for info when it is done." There is no status endpoint, so `job-status` would have nothing to poll and the tool could not report completion. Revisit when the API exposes update status. |
| `data clean` | exposed | `data-clean` | |
| `deploy` | exposed | `deploy-start` | `--dry-run` is `deploy-dry-run`, a separate tool so that no argument to it can apply a deploy (TASK-25). |
| `dns export` | later | — | Read-only, but DNS is instance infrastructure rather than application code. An agent editing Liquid has no reason to read domain records. Revisit on demand. |
| `dns import` | never | — | Writes DNS records on live domains. The interactive confirmation is the safety mechanism — `-y` exists to bypass it in CI, deliberately. Also carries `--portal-url` and `--token`, the redirecting inputs no MCP tool may take. |
| `dns migrate` | never | — | Export, backup, transform, apply and cutover against live domains, across two instances. Same redirecting options as `dns import`. |
| `dns status` | later | — | Read-only; same reason as `dns export`. |
| `dns compare` | later | — | Read-only; same reason as `dns export`. |
| `env add` | exposed | `env-add` | |
| `env list` | exposed | `envs-list` | |
| `env refresh-token` | never | — | Prompts for a password and a two-factor code. Interactive by design, and re-issuing a credential belongs to the person, not the agent. What the agent needs instead is to be told to ask for it — tracked in TASK-30. |
| `exec liquid` | exposed | `liquid-exec` | |
| `exec graphql` | exposed | `graphql-exec` | |
| `gui serve` | never | — | Long-running local web server. There is no result to return to a client that is not a browser. |
| `generate list` | exposed | `generators-list` | |
| `generate run` | exposed | `generators-run` | |
| `init` | never | — | Interactive project scaffolding wizard. |
| `logs` | exposed | `logs-fetch` | |
| `logsv2 search` | later | TASK-28 | Searches the log store with SQL. `logs-fetch` gained `since`, `errorType` and `contains` in TASK-57, which covers the common case, but it matches in the tool: the instance still reads every row in between, and there is no aggregation and no newest-first order. Needs credentials; reads only; synchronous. **Moved from `expose` to `later` on 2026-09-22: the capability does not currently work at all — see the note below.** |
| `logsv2 searchAround` | later | — | Returns the rows surrounding one row, so it is meaningless without an id from a search. Depends on TASK-28 landing first. |
| `logsv2 alerts list` | later | — | Read-only, but of little use while add, rm and trigger are all `never`. |
| `logsv2 alerts add` | never | — | Creates Slack destinations and alert rules on shared observability configuration, outside the application being developed. |
| `logsv2 alerts rm` | never | — | Deletes them; same reason. |
| `logsv2 alerts trigger` | never | — | Fires a real alert into a real channel, which people receive. |
| `logsv2 reports` | later | TASK-29 | Canned `r-4xx`, `r-slow` and `r-slow-by-count` over the `requests` stream — HTTP access logs with status codes and response times, which no MCP tool can reach today. Fixed report names, so no model-authored SQL. Needs credentials; reads only; synchronous. **Moved from `expose` to `later` on 2026-09-22: same dead proxy as `logsv2 search`.** |
| `lsp` | never | — | A Language Server Protocol server for editors. A second protocol nested inside MCP, speaking to a client that is not the model. |
| `mcp` | never | — | This server. |
| `mcp-config` | never | — | Introspects this server's own selection. The client already receives `tools/list` and the server instructions. |
| `migrations generate` | exposed | `migrations-generate` | |
| `migrations run` | exposed | `migrations-run` | |
| `migrations list` | exposed | `migrations-list` | |
| `modules list` | later | TASK-26 | The whole module dependency lifecycle is tracked as one decision in TASK-26 and is not re-opened here. |
| `modules pull` | later | TASK-26 | See TASK-26. |
| `modules remove` | later | TASK-26 | See TASK-26. |
| `modules install` | later | TASK-26 | See TASK-26. |
| `modules update` | later | TASK-26 | See TASK-26. |
| `modules uninstall` | later | TASK-26 | See TASK-26. |
| `modules init` | later | TASK-26 | See TASK-26. |
| `modules version` | later | TASK-26 | See TASK-26. |
| `modules build` | later | TASK-26 | See TASK-26. |
| `modules push` | later | TASK-26 | See TASK-26. |
| `modules overwrites diff` | later | TASK-26 | See TASK-26. |
| `modules overwrites list` | later | TASK-26 | See TASK-26. |
| `modules migrate` | later | TASK-26 | See TASK-26. |
| `modules show` | later | TASK-26 | See TASK-26. |
| `pull` | later | — | Downloads the whole application as a zip. An agent is working in a checkout and already has the code. |
| `sync` | exposed | `sync-file` | Partial, deliberately. `sync-file` sends one file; the CLI's file watcher is not exposed, because the agent is the thing making the edits and a watcher would race with it. |
| `test run` | exposed | `unit-tests-run` | Omitting `name` runs the whole suite. `tests-run-async` was removed in 6.6.0: the tests module answers `/_tests/run_async` with a `test_name` and no id, and the `/_tests/results/:id` it polled has never existed there, so it ran the suite on the instance and then dropped the handle. Rebuilding it on the module's own contract — the run's summary arrives in the log, typed `<test_name> SUMMARY` — is a separate decision. |
| `uploads push` | exposed | `uploads-push` | |
| `fetch-logs` | exposed | `logs-fetch` | The scripting front end for the same capability as `logs`. |

## Tools with no CLI equivalent

These exist only over MCP, and are not omissions in the other direction:

- `job-status` — reads back any asynchronous operation. The CLI waits in the foreground instead.
- `data-validate` — checks a data file against the instance's schema before an import.
- `generators-help` — introspects a generator's arguments, which the CLI prints as `--help`.
- `instance-create`, `partners-list`, `partner-get`, `endpoints-list` — Partner Portal operations.
- `deploy-dry-run` — what a deploy would change, which the CLI has as `deploy --dry-run`.

## Reading an instance back

Not a CLI capability, so not a row above — the decision table is derived from `bin/` and a row for
something no command does would fail its own test. Recorded here because an evaluation of this
server (2026-09-21) reported that nothing could read an instance back, which was wrong in a way
worth writing down.

- **Reading files back from an instance — exposed, via `graphql-exec`.** The instance serves an
  admin read API over GraphQL, and `graphql-exec` has always been able to reach all of it:
  `admin_pages` (with `slug`, `physical_file_path` and `content`), `admin_liquid_partials` (`path`,
  `body`), `admin_assets` (`name`, `url`, `content_type`, `file_size`), plus `admin_graphql`,
  `admin_model_schemas`, `admin_forms`, `admin_authorization_policies`, `admin_liquid_layouts`,
  `admin_tables`, `admin_current_instance` and `admin_versions`. Verified live on 2026-09-22.

  So an agent can enumerate an instance before a non-partial deploy deletes anything on it, and
  can read a file's source back. The gap was never capability; it was that nothing said so.
  `graphql-exec`'s description now names the family, which costs 128 bytes once against the
  450–900 a wrapper tool would cost on every request to duplicate it.

- **Fetching a page by path — exposed, as `page-fetch`.** The one thing the admin API cannot
  answer. `admin_pages { content }` proves the source is on the instance; routing, the layout, the
  authorization policies and every partial the page renders sit between that and a URL a visitor
  opens, so it does not prove the page is live. It is in `--profile dev` because that profile is
  named for edit → check → deploy → **verify**, and verify was the step an agent had to take
  outside this server.

- **Everything under `logsv2` is unreachable, so nothing built on it can be exposed yet.** Measured
  2026-09-22. `pos-cli logsv2 search <env>` fails with `Request failed with status 404`: the
  instance lookup succeeds and returns its uuid, then the request to the log proxy 404s.

  It is not one instance being unprovisioned, and there is no flag that turns it on. `LOGS_PROXY_URL`
  (`lib/swagger-client.js`) is the only configuration point — nothing per-environment in `.pos`, no
  config entry — and its default host answers Go's stock `404 page not found` on **every** path
  including `/healthz`, to authenticated and unauthenticated callers alike, for a real org uuid and
  a bogus one. Its TLS certificate is a wildcard for the parent domain, so DNS and TLS answering say
  nothing about a service being deployed there, and `git log -S` shows the hostname was written once
  when the feature landed and never changed.

  **The CLI and the GUI are the same route, not two.** `lib/server.js` calls `gateway.logsv2()`,
  `Gateway.logsv2` delegates to `this.client`, and `bin/pos-cli-gui-serve.js` sets that from
  `SwaggerProxy.client`. So `logsv2 search`, `searchAround`, `reports`, `alerts` and the GUI's
  Network panel all fail together — confirmed independently: the panel does not work either.

  Whether the service is retired, moved or simply unreachable from outside the platform is not
  determinable from here, and that question has to be answered before TASK-28 or TASK-29 is worth
  starting: exposing either today would add MCP tools that 404 on every call, which is exactly the
  defect `tests-run-async` was removed for. If a live host exists, `LOGS_PROXY_URL` already accepts
  it and only the default needs changing.

- **A `job-status` miss polluting the instance's error log — investigated, not reproduced.** An agent
  evaluation reported that asking about a release id the instance does not have left three
  `LowLevelError` rows (`Couldn't find MarketplaceRelease with 'id'="999999"`) in the customer's own
  error log, retried three times. Reproduced on 2026-09-22 against the same instance with a
  fabricated id: `JOB_NOT_FOUND` in 2.8 s and **no rows at all**, with zero `LowLevelError` rows in
  the whole retained log. The double-ask that would cause it is deliberate — the default `wait_ms`
  is 0, and reporting a deploy that was briefly slow as one that never existed is the worse error —
  so nothing was changed on one observation that does not reproduce. Recorded so it is not
  re-investigated from scratch; if it recurs, the count to chase is two requests, not three.

- **Recovering a lost `job_id` — not worth a parameter.** The same evaluation noted that a `job_id`
  is returned exactly once, and a deploy whose handle is lost to context compaction becomes
  unobservable. The obvious fix — letting `job-status` take `{kind, id}` instead — was measured and
  dropped: `RootQuery` exposes 36 queries and **none of them lists releases** (`admin_versions` is a
  different entity entirely, ids in the millions against releases in the tens of thousands), and
  `deploy-start` returns `id` and `job_id` in the same result, so they are lost in the same breath.
  The parameters would add surface to a `--profile dev` tool for a recovery path that cannot be
  reached. Revisit if the platform ever exposes a release listing.

- **Downloading a release archive — later.** `job-status` passes the instance's release record
  through verbatim, `downloadable: false` included, and nothing here acts on it. The field is the
  platform's, and cherry-picking a record we forward is worse than carrying a field that is
  currently always false; `pull` is the capability that would use it, and it is `later` above for
  its own reasons. If `downloadable` ever comes back true, that row is where the decision changes.

## What this audit changed

- **`pos-cli logsv2 search` did not work at all.** `lib/swagger-client.js` assigned to an undeclared
  `query`, an implicit global: legal in sloppy-mode CommonJS, a `ReferenceError` in an ES module.
  Every search had thrown since the ESM migration (`862db40`, 2026-01-29), and the command's
  `catch (e) { logger.Error(e) }` printed it as though the instance had refused. Fixed, with
  regression tests in `test/unit/swagger-client.test.js`. `logsv2 reports` and `searchAround` were
  unaffected — they do not go through `buildQuery`.
- **`mcp-min/logs/stream.js` is deleted.** It was a complete tool module that the registry never
  referenced, so it was never listed and never callable. Registering it was not an option:
  it implements `streamHandler`, the deprecated pre-SDK interface that the SDK dispatch path
  cannot call; it returns a promise that never resolves; and it polls on a `setTimeout` chain with
  no `ctx.signal` check, which is exactly the unbounded handle the shutdown rule in CLAUDE.md
  forbids. No registered tool had a `streamHandler`, so `POST /call-stream` could only ever answer
  `tool has no streamHandler`; that route went with the rest of the pre-SDK API in 6.6.0.
- The premise that logsv2 supersedes the logs stack turned out to be **overstated**. The README
  still documents `logsv2` under a roadmap with alerts, error handling and a GUI unbuilt, nothing
  deprecates `pos-cli logs`, and `logsv2 search` did not run. It is an additional capability worth
  exposing, not a replacement that the server was wrongly ignoring.
