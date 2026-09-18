# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

pos-cli is a command-line interface tool for deploying and managing platformOS applications. It provides sync mode for development, deployment capabilities, module management, data operations, and a local admin GUI. The codebase is structured as a Node.js CLI with 50+ commands and extensive integration with the platformOS API.

## Common Commands

### Development
```bash
npm ci                    # Install dependencies
npm start                 # Start development environment
npm run build             # Build production assets (for GUI components)
npm test                  # Run all tests (requires test environment credentials)
npm run test-watch        # Run tests in watch mode
```

### Testing
**The runner is vitest** (`vitest.config.js`), not Jest. It collects `test/**/*.{test,spec}.js` and
`mcp-min/__tests__/**`; a test file anywhere else is never run, however it is named.

```bash
npm test                  # every suite
npm run test:unit         # test/unit
npm run test:integration  # test/integration — needs a real instance
npm run test:mcp-min      # the MCP server's own suite, no instance needed
npm run test:watch
npm run test:coverage
DEBUG=1 npm test          # with debug output
```

`test/unit` and `mcp-min/__tests__` run against fakes and spawned processes; `test/integration`
talks to an actual platformOS instance and needs credentials, from a `.env` file or the
environment:

```bash
MPKIT_URL=https://your-test-instance.example.com
MPKIT_EMAIL=your-email@example.com
MPKIT_TOKEN=your-token
```

Files run in parallel, each in its own forked process (`pool: 'forks'`), so a test that writes to
the repository root — a `.pos`, a fixture lockfile — can fail another suite that reads it. Write
into a temp directory (`withTmpDir`, `makeWorkDir`) instead. Fixtures are in `/test/fixtures/`.

`pretest` (and `pretest:unit`) runs `npm install` in `test/fixtures/yeoman` and
`test/fixtures/yeoman/custom`. Running vitest directly skips that, and `test/unit/generators.test.js`
then stops on a yeoman prompt rather than failing outright — if a generators test appears to hang,
that is why. `npm test` and `npm run test:unit` do the install for you.

Coverage (`npm run test:coverage`) is measured over `lib/**` and `bin/**` with a 60% threshold on
lines, functions, branches and statements. `mcp-min/**` is deliberately outside it: its suite
covers the server through spawned processes and real transports, which v8 coverage of this process
does not see.

### Local Development Workflow
```bash
# After forking the repo:
npm unlink .
npm uninstall -g @platformos/pos-cli
npm link                  # Link local version globally
npm install
```

## Architecture

### Directory Structure

```
pos-cli/
├── bin/              # CLI command entry points (60+ executables)
│   ├── pos-cli.js               # Main entry point
│   ├── pos-cli-deploy.js        # Deploy command
│   ├── pos-cli-sync.js          # Sync command
│   ├── pos-cli-env-add.js       # Environment management
│   ├── pos-cli-modules-*.js     # Module commands
│   ├── pos-cli-gui-serve.js     # GUI server
│   ├── pos-cli-check.js         # Liquid code quality check
│   ├── pos-cli-check-init.js    # Generate .platformos-check.yml
│   ├── pos-cli-check-run.js     # Run platformos-check linter
│   ├── pos-cli-lsp.js           # Language Server Protocol server
│   ├── pos-cli-mcp.js           # MCP server entry point (also `pos-cli mcp`); strict args, parsed before the server loads
│   ├── pos-cli-mcp-config.js    # Display MCP tool configuration (also `pos-cli mcp-config`)
│   ├── pos-cli-ai.js            # AI tools command group
│   ├── pos-cli-ai-init.js       # Wizard: register MCP servers in AI tool config
│   ├── pos-cli-supervisor.js    # platformos-mcp-supervisor wrapper (validate_code MCP server)
│   └── pos-cli-fetch-logs.js    # Fetch logs as NDJSON (for scripting/MCP)
├── lib/              # Core business logic
│   ├── proxy.js                 # Gateway class - main API client
│   ├── ServerError.js           # Centralized error handling
│   ├── settings.js              # Environment configuration (.pos file)
│   ├── environments.js          # Authentication flows
│   ├── utils/twoFactor.js       # Partner Portal 2FA: prompt/retry around password auth
│   ├── twoFactorSession.js      # Instance 2FA sessions, cached in .pos per environment
│   ├── portal.js                # Partner Portal API client
│   ├── watch.js                 # File watching for sync mode
│   ├── archive.js               # Deployment archive creation
│   ├── push.js                  # Archive upload
│   ├── check.js                 # Liquid/JSON linter (platformos-check)
│   ├── ai.js                    # AI tool MCP config wizard (pos-cli ai init)
│   ├── templates.js             # Mustache template processing
│   ├── modules.js               # Module lifecycle management
│   ├── deploy/                  # Deployment strategies
│   ├── audit/                   # Code quality checks
│   ├── data/                    # Import/export/clean
│   ├── assets/                  # Asset deployment
│   ├── logsv2/                  # OpenObserve logs integration
│   ├── validation/              # Ajv schema validation (shared by GUI + MCP)
│   └── validators/              # CLI argument validators (url, email, paths)
├── mcp-min/          # MCP server implementation
│   ├── index.js                 # start({ selection, http }): stdio + HTTP transports, one shared shutdown
│   ├── cli-args.js              # pos-cli-mcp argument parsing (tool selection, --no-http, --help/--version)
│   ├── lifecycle.js             # When the process ends: stdin EOF rule, drain, 120 s deadline
│   ├── cancellation.js          # ctx.signal helpers for tools that wait or page
│   ├── jobs/                    # job-status: one status tool for every async operation
│   │   ├── status.js            # The tool: parse the handle, pin the instance, poll, optionally wait
│   │   ├── handle.js            # The job_id: mint/parse, strictly, with a per-kind flag allowlist
│   │   ├── auth-for-job.js      # Credentials for the instance a job was started on
│   │   ├── local-phases.js      # Asset uploads this process started (nothing else can see them)
│   │   └── adapters/            # One per kind: poll(deps, id, flags) → { state, status, result }
│   ├── protocol/                # The MCP protocol layer (MCP TypeScript SDK v2)
│   │   ├── server-factory.js    # One McpServer definition: tools, schemas, errors, progress, cancellation
│   │   └── http-endpoint.js     # /mcp: Express ⇄ web-standard bridge for the SDK's HTTP handler
│   ├── stdio-server.js          # MCP over stdio (for editor integrations)
│   ├── http-server.js           # HTTP transport: /mcp + the deprecated pre-SDK routes (127.0.0.1:5910)
│   ├── http-config.js           # MCP_MIN_HOST / MCP_MIN_PORT / MCP_MIN_ALLOWED_HOSTS, fails closed
│   ├── host-validation.js       # Host/Origin check on every HTTP route (DNS rebinding)
│   ├── tools.js                 # Tool registry (a Map, client order); reads no configuration
│   ├── profiles.js              # Built-in tool profiles: full (default), dev, none
│   ├── tools-config.js          # Reads + validates tools.config.json / MCP_TOOLS_CONFIG (the only reader)
│   ├── tool-selection.js        # Profile + --include/--exclude-tools + config → exposed tools; findTool
│   ├── tools.config.json        # Enable/disable tools, customize descriptions
│   └── <tool-name>/             # One directory per tool group (deploy/, data/, etc.)
├── gui/              # Web UI applications
│   ├── graphql/                 # GraphiQL IDE (React, pre-built)
│   ├── liquid/                  # Liquid evaluator (pre-built)
│   └── next/                    # Main GUI (Next.js, pre-built)
├── test/             # Integration tests
│   └── fixtures/                # Test projects
└── scripts/          # Utility scripts
```

### Command Structure Pattern

**Entry Points (bin/)**: Each command is a separate executable. Commands are thin wrappers that:
1. Parse arguments using Commander.js
2. Fetch authentication data from settings
3. Delegate to lib/ modules for implementation

Example:
```javascript
// bin/pos-cli-deploy.js
import { fetchSettings } from '../lib/settings';
import deployStrategy from '../lib/deploy/strategy.js';

program
  .argument('[environment]', 'name of environment')
  .option('-p --partial-deploy', 'Partial deployment')
  .action(async (environment, params) => {
    const authData = fetchSettings(environment);
    deployStrategy.run({ strategy: 'directAssetsUpload', opts: { ... } });
  });
```

**Implementation (lib/)**: Contains all core logic, organized by functional area.

### Key Architectural Patterns

#### 1. Gateway Pattern - API Client
**File**: `lib/proxy.js`

The `Gateway` class is the central API client for all platformOS API communication:
```javascript
class Gateway {
  constructor({ url, token, email }) {
    this.url = url;
    this.api_url = `${url}/api/app_builder`;
    this.authorizedRequest = requestPromise.defaults({
      headers: { Authorization: `Token ${token}` }
    });
  }

  ping()          // Health check
  sync(formData)  // Sync single file
  push(formData)  // Deploy archive
  graph(json)     // GraphQL query
  // ... 20+ API methods
}
```

All commands that interact with platformOS instances use this Gateway class.

#### 2. Strategy Pattern - Deployment
**Files**: `lib/deploy/strategy.js`, `lib/deploy/directAssetsUploadStrategy.js`, `lib/deploy/defaultStrategy.js`, `lib/deploy/dryRunStrategy.js`

Three deployment strategies:
- **directAssetsUpload** (modern, default): Separates code and assets. Assets upload directly to S3, then manifest sent to API
- **default** (legacy): Everything in one archive
- **dryRun**: Uploads release archive (no assets) with `dry_run=true` flag; server validates and reports files that would be upserted/deleted without applying any changes

Strategy selection:
```javascript
import defaultStrategy from './defaultStrategy.js';
import directAssetsUploadStrategy from './directAssetsUploadStrategy.js';
import dryRunStrategy from './dryRunStrategy.js';

const strategies = {
  default: defaultStrategy,
  directAssetsUpload: directAssetsUploadStrategy,
  dryRun: dryRunStrategy,
};

const run = ({ strategy, opts }) => strategies[strategy](opts);

export { run };
```

#### 3. MCP Server Pattern
**Directory**: `mcp-min/`

The MCP (Model Context Protocol) server exposes platformOS operations as tools for AI clients. The protocol is spoken by the MCP TypeScript SDK v2 (`@modelcontextprotocol/server`), which serves revision 2026-07-28 and the 2025 revisions from one definition. It runs two transports:
- **stdio** (`stdio-server.js`): what editors and AI tools launch. `--no-http` makes it the only one.
- **HTTP** (`http-server.js`) on `127.0.0.1:5910` (env: `MCP_MIN_PORT`, `MCP_MIN_HOST`): MCP Streamable HTTP at `/mcp`, plus the pre-SDK routes (`/`, `/tools`, `/call`, `/call-stream`), which are deprecated and go at the next major.

**The HTTP transport has no authentication** — whoever can reach it runs every enabled tool with this machine's platformOS credentials. Three invariants stand in for auth; keep them when touching `http-server.js` (including the SDK migration):
- **Loopback bind by default.** `readHttpConfig` (`http-config.js`) defaults `MCP_MIN_HOST` to `127.0.0.1`, and `startHttp` defaults to it too, so a caller passing only a port is still loopback-only. A non-loopback `MCP_MIN_HOST` is an explicit opt-in and logs an unauthenticated-exposure warning on every start.
- **Host/Origin validation before everything.** `hostValidation` (`host-validation.js`) is registered app-level after the request logger and *before* `bodyParser` and the router, so every route — including ones added later and unknown paths — answers `403` to a Host/Origin hostname outside `localhost`, `127.0.0.1`, `[::1]` plus `MCP_MIN_ALLOWED_HOSTS`, without the body being parsed or a tool resolved. Status, body and messages mirror `@modelcontextprotocol/express` 2.0.0 exactly, so swapping in the SDK middleware is invisible to clients; the allowlist is enforced for non-loopback binds too, where the SDK would skip it.
- **Fail closed, report honestly.** A malformed `MCP_MIN_*` value throws `HttpConfigError` from `start()` (`index.js`), before either transport starts; `bin/pos-cli-mcp.js` reports it like `ToolsConfigError`. `startHttp` resolves only on `listening` and rejects with the listen error; `index.js` logs the address from `server.address()` on success, and on failure logs `HTTP transport not started (<code>)` and keeps serving stdio. Never log "listening" from configuration: an older pos-cli-mcp bound to `*:5910` makes a new `127.0.0.1:5910` bind fail with `EADDRINUSE` while still answering localhost traffic itself.

**Protocol layer.** `createServerFactory` (`protocol/server-factory.js`) builds the one `McpServer` both transports serve from. Keep these when touching it or either transport:
- **The SDK owns the protocol; this repo owns the tools.** Version negotiation, `server/discover`, the `_meta` envelope, error codes, notifications and cancellation are the SDK's. Tools stay plain modules with a JSON Schema and a handler returning `{ ok, … }`.
- **What is published is what is enforced.** A tool's `inputSchema` goes out through `fromJsonSchema` with a publish-only validator, byte-identically; arguments are checked in the tool callback by `rejectionFor` (`validate-params.js`), the same function the deprecated HTTP routes use. Tool schemas are enforced as JSON Schema 2020-12 — the dialect MCP 2026-07-28 assigns to a schema published without `$schema`.
- **A tool schema that does not compile stops startup**, naming the tool. The SDK builds `tools/list` from the schemas, so one it cannot use would fail the list for *every* tool; a schema is code, so this is our defect to report at startup, not a per-call error.
- **Tool failures are tool results, not protocol errors.** Invalid arguments (`INVALID_PARAMS`), a handler returning `{ ok: false }` and a handler that throws (`INTERNAL_ERROR`) all come back as `isError: true` with a JSON body carrying a code — that is what a model can act on. An unknown tool or method stays a protocol error (`-32602` / `-32601`).
- **Handler context**: `{ transport, debug, log, sendProgress, signal }`. `sendProgress` only sends when the client passed a progress token, and only ever increases; a call with a token also gets a heartbeat every `HEARTBEAT_MS`. `signal` aborts when the client cancels or goes away — a tool that waits or pages must check it (`cancellation.js`), or it keeps calling the instance for a client that has stopped listening.
- **stdio** (`serveStdio`, dual-era): the SDK does not end the connection when stdin closes, which is what lets in-flight calls finish; the session's end is decided by the TASK-14 rule below. Never close the SDK handle on shutdown — that aborts those calls. Direct method invocation (`{"method":"envs-list"}`) is gone; only MCP methods are served.
- **`/mcp`** (`protocol/http-endpoint.js`): an Express ⇄ web-standard bridge, mounted after Host/Origin validation and *before* `bodyParser` (the SDK reads the body itself). It caps the body at `MCP_BODY_LIMIT_BYTES`, aborts the call when the client disconnects, and registers `subscriptions/listen` streams with `trackStream` so shutdown ends them while ordinary calls drain.
- **`--no-http` does not read `MCP_MIN_*` at all.** With no listener there is nothing to expose, and a stale value in an editor's environment must not stop a stdio server. It is what `pos-cli ai init` writes.
- **`annotations.readOnlyHint`** is a reviewed set (`tool-annotations.test.js`), on tools that change nothing locally or on the instance. Omitting it means "may change things", which is the right default.

**Logging: one sink, redacted centrally** (`mcp-min/log.js`, `mcp-min/redact.js`). Everything the server writes goes to stderr and to `~/.pos-cli/logs/mcp-min.log` (`MCP_MIN_LOG_FILE`), which outlives the session and is shared by every session on the machine; `DEBUG=1` is what people turn on precisely when credentials are moving. Keep these:
- **stdout belongs to the protocol.** `mcp-min/log.js` writes to stderr and the log file, never stdout, and `lib/logger.js` routes its stdout methods (`Info`, `Success`, `Log`, `News`, `Print`) to stderr while `isServerMode()`. CLI code called from a tool — `Gateway`'s Portal retry, a two-factor session message — would otherwise put non-JSON bytes into a stdio client's channel mid-response.
- **Redaction happens in `log.js`, not at call sites.** `write()` passes every data object through `redact()` and every message through `scrubString()`. Masking by hand at one call site is a rule the next one will not know about; centrally, a leak takes a new *kind* of secret rather than a new logging line. Adding one means adding a key to `SECRET_KEYS` or `MASKED_KEYS` in `redact.js` — normalised, so an API-key header, its `SHOUTING_SNAKE` form and its camelCase form are one name.
- **Two treatments, deliberately.** A secret (`authorization`, `cookie`, `password`, `mcp-session-id`, `device_code`…) is replaced whole: part of a password is still a leak, and one `Cookie` can carry several credentials. A credential *name* (`token`, `access_token`, `jwt`…) is masked to `abc...xyz` — enough to tell which credential, not enough to use, and the same shape `maskToken` (`auth.js`) writes into tool results. Under 12 characters it is redacted instead, because three of eight is most of the secret.
- **Credentials also travel inside strings**, so `Token …`/`Bearer …` and sensitive URL query values (`access_token`, `device_code`, `user_code`, `password`…) are scrubbed wherever they appear, including in the message.
- **A log line must never fail a request.** `serialise()` catches everything — a cycle, a bigint, a getter that throws — and writes `[unserialisable]` rather than propagating. Structures are bounded (`MAX_DEPTH`, `MAX_STRING_LENGTH`) so a `data-import` payload cannot become a megabyte of log.
- **The file is owner-only**: created `0600`, and an existing one (every log written before this) is tightened once per process through `restrictToOwner`.
- **Do not log a whole `params`, a whole request body or a whole upstream response.** Redaction is the floor, not the plan: name the fields that help (`tokenProvided: true`, `accessTokenReceived: false`, an error code). `mcp-min/portal/env-add.js` is the worked example — it used to log its params object, with the instance token in it, at INFO.

**Invocation and lifetime.** MCP clients start `pos-cli-mcp` (or `pos-cli mcp`, a commander executable subcommand that spawns the same bin with stdio inherited) and stop it by closing stdin. Keep these when touching the bins, `stdio-server.js` or `index.js`:
- **Arguments and the tool selection are settled before any transport starts.** `bin/pos-cli-mcp.js` calls `parseServerArgs` (`cli-args.js`), then `selectTools`, then `start({ selection })` from `mcp-min/index.js` (importing it starts nothing); `--help`/`--version` set `process.exitCode` (not `process.exit()`, which can truncate output on a pipe) and never load the server. Unknown options and positionals are rejected, not ignored: every option decides what an unauthenticated server exposes, so a typo must fail closed. `pos-cli mcp -v` is answered by `pos-cli` itself, with the same package version.
- **stdin EOF ends the session** when stdin is a client pipe/socket, or when stdio carried at least one message (`stdinEndEndsSession`). `</dev/null`, a file or a TTY with no messages keeps HTTP serving — that is how the HTTP transport runs alone.
- **Shutdown drains; it does not `process.exit()`.** `createShutdown` (`lifecycle.js`) is shared by both transports: on EOF, stdio stops reading and `stopHttp` (`http-server.js`) stops accepting, destroys SSE streams, and closes each keep-alive connection as soon as its in-flight response finishes (otherwise it idles for the 5 s keep-alive timeout and holds the process). The process then exits by itself, so responses are written and background work a tool started (deploy-start's asset upload) completes. An unref'd deadline (`SHUTDOWN_DEADLINE_MS`, 120 s — covers `waitForUnpack`'s 90 s) forces exit 0 if something never finishes. A transport that finishes starting after shutdown began is stopped at once (`onShutdown` runs late closers immediately).
- A new long-lived handle (interval, stream, socket) in a tool or transport must end when its request does, or it will hold every shutdown until the deadline.

**Tool selection.** Which tools a server exposes is `(tools of --profile ∪ --include-tools) − --exclude-tools − tools disabled in tools.config.json`, resolved once at startup. Keep these when touching tools, profiles, the config or a transport:
- **`tools.js` is only the registry**: a `Map` of every tool in the order clients see, with no import-time configuration. `full` is computed from it, so a new tool reaches `full` by being registered; it reaches `dev` (`profiles.js`) only when added there on purpose.
- **One resolution, shared.** `selectTools` (`tool-selection.js`) loads the config through `loadToolsConfig` (`tools-config.js`, the only reader of that file and the only place the enabled/disabled rule lives) and resolves the options. `bin/pos-cli-mcp.js` and `bin/pos-cli-mcp-config.js` both call it, with options defined once (`addToolSelectionOptions`), so `pos-cli mcp-config` prints — and refuses — exactly what the server would.
- **Transports receive the exposed tools and have no default.** `startStdio({ tools })` and `startHttp({ tools })` throw without a `Map`, so no caller can end up serving every registered tool by leaving it out. The selection is fixed for the process and identical on both transports: MCP forbids `tools/list` varying per connection, and it is always registry order.
- **Hidden means uncallable.** A tool outside the selection is never registered with the SDK, so `tools/call` over stdio and `/mcp` answers it exactly like a name that matches no tool. The deprecated routes (`POST /call`, `POST /call-stream`, JSON-RPC `tools/call`) look tools up with `findTool`, which only finds exposed tools and never `Object.prototype` names. The HTTP transport has no authentication, so a listed-but-hidden tool that could still be called would make profiles cosmetic.
- **The selection fails closed**: an unknown profile or tool name (Map lookups, so `constructor` is unknown), a name in both options, `--include-tools` naming a config-disabled tool, or an empty result throws `ToolsConfigError` before any transport starts.
- **A description must not name a tool its built-in profile hides** — the model would go looking for it. `tool-selection.test.js` checks every built-in profile; a tool whose description points at another tool has to be exposed with it.
- Bare `pos-cli-mcp` stays `full` in 6.x. `pos-cli ai init` writes `--profile dev`; `lib/ai.js` upgrades only entries equal to a form it wrote before (`PREVIOUS_SERVERS`) and leaves any other differing entry alone. Changing the written args means adding the old form there.

Each tool group lives in its own directory (`deploy/`, `data/`, `logs/`, etc.) and calls the Gateway directly (no CLI subprocess spawning).

```javascript
// bin/pos-cli-mcp.js
const selection = selectTools(parsed.selection);  // profile + options + tools.config.json → exposed tools
await start({ selection, http: parsed.http });    // mcp-min/index.js; http: false for --no-http

// mcp-min/index.js — start()
const shutdown = createShutdown();                                  // shared: stdin EOF stops both transports
startStdio({ tools: selection.tools, shutdown });                   // MCP over stdio (serveStdio, dual-era)
await startHttpTransport(httpConfig, selection.tools, shutdown);    // /mcp + deprecated routes

// mcp-min/protocol/server-factory.js — the definition both transports serve
server.registerTool(name, { description, inputSchema: fromJsonSchema(tool.inputSchema, PUBLISH_ONLY), annotations },
  async (args, ctx) => { /* rejectionFor → isError, then tool.handler(args, { signal, sendProgress, … }) */ });
```

Tools include: envs-list, env-add, job-status, deploy-start, sync-file, logs-fetch, graphql-exec, liquid-exec, data-import/export/clean/validate, migrations-list/generate/run, unit-tests-run, tests-run-async, constants-list/set/unset, generators-list/help/run, check-run, uploads-push, portal tools (instance-create, partners-list, partner-get, endpoints-list), plus the six deprecated status tools (deploy-status, deploy-wait, data-import-status, data-export-status, data-clean-status, tests-run-async-result).

#### 3a. Asynchronous operations: one `job-status`, and what a `job_id` may decide

Five tools start work that outlives the call (`deploy-start`, `data-import`, `data-export`, `data-clean`, `tests-run-async`). Each returns a `job_id` and `job-status` (`mcp-min/jobs/`) reads any of them back. Keep these when touching `mcp-min/jobs/` or a starter:

- **The handle is self-contained, and untrusted.** `mint`/`parse` (`jobs/handle.js`) encode the kind, the remote id, the instance origin and a per-kind flag allowlist. It is not a key into a table in this process: MCP clients restart stdio servers while the agent keeps its conversation, and a table would make every restart an "unknown job". Because it travels through the model, `parse` is strict — unknown kind, an id outside `^[A-Za-z0-9_-]{1,128}$`, an origin that is not exactly `new URL(o).origin`, an unexpected field or a flag the kind does not have are all `INVALID_JOB_ID`.
- **Nothing in a handle chooses credentials or a URL.** `authForJob` (`jobs/auth-for-job.js`) resolves credentials the way every tool does, then *compares* origins: equal → use them; the caller named an instance that does not match → `JOB_INSTANCE_MISMATCH`; nothing named and exactly one `.pos` environment points at the job's instance → use that one; otherwise refuse. The refusal happens before any request, which is what the mismatch tests assert. A forged origin therefore cannot point this machine's token anywhere.
- **The adapters are the only place a remote status is interpreted**, and the deprecated status tools run on them too, so the two can never disagree. `state` is `running` | `completed` | `failed`, where `completed` means the operation finished (a test run with failing assertions is `completed`) and `failed` means the operation itself failed. An unrecognised remote status is `running` — the job exists, so "finished" would be a lie — and is logged.
- **A deploy finishes twice.** The release import and the asset upload are reported independently, so `jobs/adapters/deploy.js` combines them, taking the phase from `local-phases.js` first (only the process that started an upload can see it) and then from the release record. `unknown` is a real answer after a restart; reporting `running` forever would be worse. `deploy/assets-task.js` waits for the release to settle before sending the manifest, as `lib/push.js` + `directAssetsUploadStrategy` do — sending one mid-import is untested against the API.
- **No tool takes an argument that moves the request.** Eight did (`deploy-status`, `deploy-wait`, `logs-fetch`, `graphql-exec`, `liquid-exec`, `migrations-list/generate/run`): `endpoint` replaced the URL while the `.pos` token was still sent, so a name a model read somewhere could redirect this machine's credentials. The URL comes from the resolved credentials, full stop. `request-target.test.js` checks every registered tool for a redirecting parameter by name and scans the sources for `params.endpoint`, so a new tool inherits the rule. Calling another instance is the explicit-credentials path (`url` + `email` + `token`), where the caller brings the credential with the host.

#### 4. File Watching Pattern - Sync Mode

**File**: `lib/watch.js`

Sync mode watches files and pushes changes in real-time:
```javascript
const queue = Queue((task, callback) => {
  switch (task.op) {
    case 'push': push(gateway, task.path).then(callback);
    case 'delete': deleteFile(gateway, task.path).then(callback);
  }
}, program.concurrency); // Default: 3 concurrent connections

chokidar.watch(directories)
  .on('change', fp => shouldBeSynced(fp) && enqueuePush(fp))
  .on('add', fp => shouldBeSynced(fp) && enqueuePush(fp))
  .on('unlink', fp => shouldBeSynced(fp) && enqueueDelete(fp));
```

Key features:
- Queue-based async processing with configurable concurrency
- Respects .posignore patterns
- Optional LiveReload integration
- Debouncing to prevent excessive uploads

#### 5. Template Processing Pattern
**File**: `lib/templates.js`

Modules support ERB/EJS-style templates (`<%= var =%>`) for configuration:
```javascript
const fillInTemplateValues = (filePath, templateData) => {
  if (qualifedForTemplateProcessing(filePath) && hasTemplateValues(templateData)) {
    const fileBody = fs.readFileSync(filePath, 'utf8');
    return mustache.render(fileBody, templateData, {}, ['<%=', '=%>']);
  }
  return fs.createReadStream(filePath);
};
```

Values sourced from `modules/*/template-values.json` (custom params) and `modules/*/pos-module.json` (identity scalars: `machine_name`, `version`, `name`). The two files are merged — `pos-module.json` is the base and `template-values.json` overlays on top. Processed during sync and deploy; never touched by the modules CLI.

#### 6. Authentication Flow
**Files**: `lib/environments.js`, `lib/envs/add.js`

Two authentication methods:
- **Device Authorization Flow** (modern, OAuth-style): Opens browser for authentication, no password in CLI
- **Email/Password Flow** (legacy): Direct credentials

Tokens stored in `.pos` configuration file (JSON format).

#### 7. Error Handling
**File**: `lib/ServerError.js`

Centralized error handling with specific handlers for different HTTP status codes (401, 404, 500, 502, 504, etc.). Each handler provides user-friendly messages and controls process exit behavior.

### Important Technical Details

#### Configuration Files
- `.pos` - Environment credentials (URL, token, email) as JSON. Also caches a `two_factor_session` (`{token, expires_at}`) per environment when an instance requires one. Every writer goes through `writeFileOwnerOnly` (`lib/filePermissions.js`), so each write leaves the file at 0600 where the platform has permission bits
- `.posignore` - Files to exclude from sync/deploy (gitignore syntax)
- `pos-module.json` - Universal platformOS project manifest (analogous to `package.json`). Its presence in a consuming app is normal — it lists `dependencies`. Publishable modules additionally have `machine_name`, `version`, and `name`. It is the **sole source** for all `modules` CLI commands (`install`, `update`, `push`, `version`, `migrate`).
- `pos-module.lock.json` - Resolved dependency versions (separate prod/dev sections) plus a `registries` map recording which registry each module was resolved from; makes the lock self-contained for `--frozen` mode
- `modules/*/template-values.json` - Optional: custom template substitution values **only** (e.g. `prefix`, `namespace`). Never contains metadata (`machine_name`, `version`, etc.) — those belong in `pos-module.json`. Read during sync/deploy; never read by the modules CLI.

Legacy (still read as a fallback, but never written):
- `app/pos-modules.json` - Old module list location; migrate with `pos-cli modules migrate`

#### platformOS Directory Structure
pos-cli expects projects to follow this structure:
```
project/
├── pos-module.json               # Module manifest (replaces app/pos-modules.json)
├── pos-module.lock.json          # Resolved dependency lock file
├── app/ (or marketplace_builder/)  # Main application
│   ├── assets/                     # Static assets
│   ├── views/                      # Liquid templates
│   ├── graphql/                    # GraphQL queries/mutations
│   ├── schema/                     # Data models
│   ├── authorization_policies/     # Access control
│   └── migrations/                 # Database migrations
├── modules/                        # Installed/local modules
│   └── <module-name>/
│       ├── public/                 # Public module files
│       ├── private/                # Private module files
│       ├── pos-module.json         # Module identity (installed by pos-cli modules install)
│       └── template-values.json    # Optional: custom template substitution values (no metadata)
├── .pos                            # Environment configuration
└── .posignore                      # Ignore patterns
```

Run all commands from project root (one level above `app/` or `modules/`).

**Module staging** (`lib/modules/staging.js`). `pos-cli modules install/update` never downloads or extracts into an installed module directory. Each archive is fetched into its own throwaway staging directory under `tmp/pos-cli-module-staging/` and unpacked there; only after it is verified to contain the expected `<name>/` root is it published with two renames — the old `modules/<name>` moves into the staging directory, then the staged tree is renamed onto `modules/<name>`. Moving the old tree aside wholesale (rather than unpacking over it) is what makes files deleted between two versions actually disappear; the second rename being atomic is what guarantees `modules/<name>` is never observed half-written. A half-written module whose `pos-module.json` already reports the target version is indistinguishable from an up-to-date one (see `modulesNotOnDisk`), so it would never be repaired.

Staging lives under the project's `tmp/` (already pos-cli's scratch area — deploy writes `tmp/release.zip` there) for two reasons: publishing ends in a `rename()` onto `modules/<name>`, which fails with `EXDEV` across filesystems, so `os.tmpdir()` is not safe to use; and nothing enumerates project-root `tmp/`, since every glob over modules runs with `cwd` set to `modules/` and sync only watches `dir.toWatch()`. A staging directory therefore cannot be deployed, packed, or synced by construction, with no per-enumerator exclusions to maintain.

#### API Architecture
Main endpoints (`${INSTANCE_URL}/api/app_builder/`):
- `/marketplace_releases` (POST) - Deploy archive
- `/marketplace_releases/sync` (PUT) - Sync single file
- `/marketplace_releases/sync` (DELETE) - Delete file
- `/marketplace_releases/:id` (GET) - Check deploy status
- `/logs` (GET) - Streaming logs
- `/exports`, `/imports` - Data operations
- `/migrations` - Migration management
- `/installed_modules` - Module operations

GraphQL endpoint: `${INSTANCE_URL}/api/graph`

#### Asset Deployment Flow (directAssetsUpload)
1. Create release.zip WITHOUT assets → `/tmp/release.zip`
2. Upload release.zip to API
3. Collect all assets from `app/assets/` and `modules/*/public/assets/`
4. Create assets.zip
5. Get presigned S3 URL from platformOS
6. Upload directly to S3
7. Generate manifest.json with file paths and hashes
8. Send manifest to API → triggers CDN sync

This approach significantly speeds up deployments with large asset libraries.

#### Environment Variables
Key variables that affect behavior:
- `MPKIT_URL/MPKIT_EMAIL/MPKIT_TOKEN` - Direct auth (bypasses .pos file)
- `CONFIG_FILE_PATH` - Custom config file location
- `TEMPLATE_VALUES_FILE_PATH` - Custom template values path
- `CI` - Disables audit checks and notifications
- `DEBUG` - Enables debug logging
- `NO_COLOR` - Disables colored output
- `CONCURRENCY` - Override sync concurrency (default: 3)
- `PARTNER_PORTAL_HOST` - Override the module registry URL used by `modules install` and `modules update` (default: `https://partners.platformos.com`). `pos-cli env add --partner-portal-url` stores its value per environment as `partner_portal_url` in `.pos`, and `pos-cli deploy` exports that stored value as `PARTNER_PORTAL_HOST` for the run.

#### Module System
Complete lifecycle:
- **Init**: Create from template (github.com/Platform-OS/pos-module-template)
- **Install**: Add to `pos-module.json`, resolve the full dependency tree, write `pos-module.lock.json`, and download all changed/missing modules to `modules/`
- **Install --frozen**: CI-safe install — uses the existing lock file as-is, never calls the registry for resolution, fails fast if the lock file is missing or stale
- **Publish**: Version and push to marketplace (requires Partner Portal account)
- **Pull**: Get deployed version from instance
- **Update**: Update a module entry in `pos-module.json`, re-resolve the full tree, update the lock file, and download changed modules
- **Migrate**: `pos-cli modules migrate` runs two independent phases:
  - **Phase A**: converts legacy `app/pos-modules.json` → `pos-module.json` (deps migration)
  - **Phase B**: moves metadata fields (`machine_name`, `version`, `name`, `repository_url`) from any `template-values.json` → `pos-module.json`, stripping them from the source file. Use `--name <machine_name>` to target a specific `modules/<name>/template-values.json` when multiple exist.

Note: `pos-cli modules download` has been removed. `install` and `update` always download all module files and dependencies automatically.

Module manifest `pos-module.json` (unified format for both apps and publishable modules):
```json
{
  "name": "User",
  "machine_name": "user",
  "version": "5.1.2",
  "repository_url": "https://partners.platformos.com",
  "dependencies": {
    "core": "^1.5.0"
  },
  "devDependencies": {
    "tests": "1.0.1"
  },
  "registries": {
    "private-module": "https://portal.private-stack.online"
  }
}
```

`repository_url` is **publishing metadata only** — it tells `pos-cli modules push` where to publish the module. It has **no effect** on dependency resolution. The registry used for `install`/`update` is determined by `PARTNER_PORTAL_HOST` (env var) or the hardcoded fallback `https://partners.platformos.com`.

The optional `registries` map provides **per-module registry URL overrides** for private or custom registries. After each `install` or `update`, every resolved module gets an explicit entry stamped into the lock file's `registries` map, making `pos-module.lock.json` self-contained for `--frozen` mode. Old lock files without per-module entries fall back to the hardcoded default.

The `--dev` flag controls which section a named module is added to:
```
pos-cli modules install core           # adds core to dependencies
pos-cli modules install tests --dev    # adds tests to devDependencies
pos-cli modules install --dev          # installs dependencies + devDependencies
pos-cli modules install --frozen       # CI: use lock file as-is, no resolution
pos-cli modules install --frozen --dev # CI: same, including devDependencies
pos-cli modules update core            # bumps core to latest stable
pos-cli modules update core@2.0.0     # pins core to exact version
pos-cli modules update --dev           # re-resolves both sections
```

**Update semantics for exact pins**: `pos-cli modules update` (no name) does not bump exact-pinned
entries — it only re-resolves range constraints to the best available version within the range.
To bump an exact pin, name it explicitly: `pos-cli modules update core`.
This matches npm's behaviour where `npm update` does not modify exact pins.

#### GUI Server
Express server (`lib/server.js`) serves three pre-built web apps:
- Admin panel (port 3333, configurable with --port)
- GraphiQL browser (http://localhost:3333/gui/graphql)
- Liquid evaluator (http://localhost:3333/gui/liquid)

Can run with sync: `pos-cli gui serve staging --sync --open`

### Key Dependencies
- **commander** v14 - CLI framework
- **chokidar** - File watching with native fsevents on macOS
- **express** - GUI server
- **yazl** - Zip creation
- **request/request-promise** - HTTP client
- **mustache** - Template rendering (ERB/EJS-style)
- **fast-glob** - File pattern matching
- **inquirer/prompts** - Interactive CLI prompts
- **chalk** - Terminal colors
- **ora** - Loading spinners
- **yeoman-generator** - Code generators

## Input Validation (Ajv)

**Key files**: `lib/validation/index.js`, `lib/validation/schemas/gui.js`,
`mcp-min/validate-params.js`, `mcp-min/schemas/auth.js`, `mcp-min/schemas/default.js`

Untrusted input is validated against JSON Schema with **Ajv** (draft-07) before it reaches
any handler. Ajv is used rather than a code-first library because the MCP protocol requires
JSON Schema on the wire: each tool's `inputSchema` is advertised verbatim in `tools/list`,
so the schema we publish and the schema we enforce are the same object and cannot drift.

`lib/validation/index.js` exposes one function:

```javascript
import { validate } from '#lib/validation/index.js';

const result = validate(schema, data);            // { valid, errors, message, schemaError }
const coerced = validate(schema, req.query, { mode: 'coercing' });
```

- **`strict` mode (default)** — for JSON bodies. Leaves the caller's data untouched.
- **`coercing` mode** — for query strings, where every value arrives as a string. Ajv
  applies coercion and defaults **by mutating the object in place**.
- **`result.schemaError`** — the schema itself would not compile. That is our defect, not
  the caller's, so report it as 500 / `-32603` — but still reject, because nothing was
  actually checked. Reserved for genuine compile failures: an unknown `mode` throws a
  `RangeError` (a caller bug), and boolean schemas — legal JSON Schema that cannot key the
  compile cache — validate normally rather than surfacing as a phantom compile failure.

`validate()` returns only `{ valid, errors, message, schemaError }`. It does not return the
data; in `coercing` mode the caller's own object is what gets mutated.

Ajv runs in `strict: true` mode so a malformed schema fails loudly at compile time.
`allowUnionTypes` is the one rule relaxed, for fields that genuinely accept two types —
`logsSearchSchema.query`, which arrives as an object over POST and a string over GET, is
the only one. `ajv-formats` is loaded, and `format: 'uri'` / `format: 'email'` on the shared
auth properties are what use it.

### Enforcement points

| Where | What is validated |
|---|---|
| `mcp-min/protocol/server-factory.js` — stdio and `/mcp` `tools/call` | tool params vs `inputSchema` → `isError` result, code `INVALID_PARAMS` |
| `mcp-min/http-server.js` — deprecated `POST /call`, `/call-stream` | same → 400 |
| `mcp-min/http-server.js` — deprecated JSON-RPC `tools/call` | same → `-32602` |
| `mcp-min/tools-config.js` | `tools.config.json` vs `tools.config.schema.json`, plus tool names |
| `lib/server.js` | GUI requests for graph / liquid / logs / logsv2 / sync |

Every MCP dispatch site (the first three rows) routes through `rejectionFor` in
`mcp-min/validate-params.js`, so one place decides what a rejection becomes: a tool result with
`isError` on the MCP paths, as the 2026-07-28 tools specification asks — the model reads it and
can correct itself — and the status codes (400/500, `-32602`/`-32603`) the deprecated routes
still answer with. Tool schemas are validated in the 2020-12 dialect (`TOOL_SCHEMA_DIALECT`);
the GUI's own schemas stay draft-07. The GUI server keeps its own
`rejectInvalid` in `lib/server.js` because it answers with a different body shape; the two
apply the same 400/500 rule and have to be changed together.
A tool that declares no schema falls back to `OPEN_OBJECT_SCHEMA` in
`mcp-min/schemas/default.js` — the same constant both `tools/list` responses advertise, so
what is published and what is enforced cannot disagree.

Adding a tool to `mcp-min/` needs no wiring: both transports validate against whatever
`inputSchema` the tool declares. A tool with no schema accepts any object.

### Two rules to preserve

**`env` must stay optional on tools that authenticate.** `resolveAuth` (`mcp-min/auth.js`)
resolves credentials in this order:

1. explicit `url` + `email` + `token` params
2. the named `.pos` environment (`params.env`)
3. `MPKIT_URL` / `MPKIT_EMAIL` / `MPKIT_TOKEN` env vars
4. the first entry in `.pos`

**The MCP server and the CLI resolve a named environment differently, on purpose.** `fetchSettings`
(`lib/settings.js`) answers from `MPKIT_*` first and falls back to `.pos`, because CI exports those
variables and still names an environment on the command line. `resolveAuth` reads the named
environment from `.pos` and nowhere else (`settingsFromDotPos`), because here the name comes from a
model that was told which instance to use: falling back would send a deploy somewhere else while
reporting the name it was given. Do not "align" the two — `mcp-min/__tests__/auth.env-resolve.test.js`
pins both orders, with the reason.

Marking `env` as `required` would reject three of those four supported call styles. Tools
closing their schema with `additionalProperties: false` must also spread in
`authProperties` from `mcp-min/schemas/auth.js`, or the explicit-credentials path becomes
unreachable. That rule is enforced by `mcp-min/__tests__/validate-params.test.js`, which
derives the tool list by scanning for `resolveAuth` rather than hard-coding names — a
hand-written list silently stops guarding tools added later.

Because `env` is advertised as optional, an MCP client that omits it lands on step 4 — the
*first* `.pos` entry — including for mutating tools (`data-import`, `constants-set`,
`uploads-push`). Runtime behaviour is unchanged, since nothing enforced `required` before,
but the advertised contract now invites the omission.

**The tools config fails closed.** A missing, unreadable or unparseable config falls back to
defaults (logged as a warning when `MCP_TOOLS_CONFIG` named it, and shown by `pos-cli
mcp-config`); one that parses but is invalid throws `ToolsConfigError`. That file decides
which tools are exposed, so ignoring a broken one would silently re-enable every tool the
author meant to switch off. Two checks, because the schema alone is not enough: it validates
the shape, and `loadToolsConfig` (`tools-config.js`) separately rejects entries naming a tool
that does not exist — a typo like `deploy-strt` would match nothing and otherwise leave
`deploy-start` enabled while the config looks like it took effect. Both
`bin/pos-cli-mcp.js` and `bin/pos-cli-mcp-config.js` catch the error and report it through
`logger`, with the same message, so a config mistake never surfaces as a Node stack trace.

### Testing Philosophy
Behaviour is tested where it actually happens. `test/integration` drives the built CLI against a
real platformOS instance — deploy strategies and their error handling, sync (changes, assets,
deletion), modules, data import/export, audit rules, file validation — because those are the paths
where a mocked API would prove nothing. It needs `MPKIT_URL` / `MPKIT_EMAIL` / `MPKIT_TOKEN`;
`test/global-setup.js` skips its cleanup when no real credentials are present.

`test/unit` and `mcp-min/__tests__` need no instance and no credentials: they use fakes, temp
directories and spawned processes, which is what makes them worth running on every change. The MCP
suite in particular starts real servers and speaks the protocol to them over stdio and HTTP.

A test is only worth having if it fails when the behaviour it names is broken. For anything
load-bearing — a security boundary, a protocol rule, a migration that rewrites someone's file —
check that by breaking the code on purpose and watching the test catch it, and prefer asserting the
observable outcome (what was written, what was sent, what the client received) over how the code
got there.

## Development Practices

### Code Quality
- Code must be tested (see test/ directory for patterns)
- PRs should explain what the feature does and why
- Be consistent with existing patterns (Gateway for API calls, thin bin/ files, logic in lib/)
- Code should be generic and reusable

### Adding New Commands
1. Create bin file: `bin/pos-cli-mycommand.js`
2. Add to package.json `bin` section
3. Implement logic in lib/ module
4. Use Gateway class for API calls
5. Use settings.fetchSettings() for environment auth
6. Add integration tests in test/
7. Update README.md with command documentation

### Working with GUI Components
GUI apps are pre-built (in dist/ or build/ directories). To modify:
1. Navigate to specific GUI directory (e.g., `gui/next/`)
2. Make changes to source files
3. Run build process (`npm run build`)
4. Commit built assets (they're included in npm package)

### Error Handling Guidelines
- Use ServerError handlers for API errors
- Provide user-friendly error messages
- Log to logger for consistent formatting
- Decide whether error should exit process or allow retry

### External Service Dependencies
- **platformOS API** - Main backend (deploy, sync, data, logs)
- **Partner Portal** - Authentication via JWT, module marketplace
- **S3** - Direct asset uploads (presigned URLs)
- **OpenObserve** - Log aggregation and search (logs v2)
- **CDN** - Asset delivery and verification

## Cross-Platform Compatibility

pos-cli must work correctly on both Windows and Linux/macOS. Follow these patterns to ensure cross-platform compatibility:

### Path Handling Patterns

#### 1. **Use Node.js `path` Module for Filesystem Operations**
Always use `path` module functions for filesystem operations, never hardcode path separators:

**✓ Correct:**
```javascript
const filePath = path.join(baseDir, 'app', 'views', 'page.liquid');
const absPath = path.resolve(relativePath);
const relPath = path.relative(baseDir, absPath);
const dir = path.dirname(filePath);
const filename = path.basename(filePath);
const ext = path.extname(filePath);
```

**✗ Incorrect:**
```javascript
const filePath = baseDir + '/app/views/page.liquid';  // Breaks on Windows
const parts = filePath.split('/');  // Breaks on Windows (use path.sep)
```

#### 2. **Normalize Paths to Forward Slashes for API/Output**
The platformOS API and user-facing output should always use forward slashes. Use this pattern:

```javascript
// Pattern from lib/watch.js
const filePathUnixified = filePath =>
  filePath.replace(/\\/g, '/');  // Convert backslashes to forward slashes

// Alternative pattern from lib/check.js
const normalizedPath = filePath.split(path.sep).join('/');
```

**When to use:**
- Before sending paths to platformOS API
- For user-facing output (logs, error messages)
- For pattern matching with regex
- For JSON output

#### 3. **Path Splitting with `path.sep`**
When you need to split a path into components, use `path.sep`:

```javascript
// Extract module name from path like "modules/my-module/file.js"
const moduleName = filePath.split(path.sep)[1];

// Join path components
const normalizedPath = filePath.split(path.sep).join('/');
```

#### 4. **Complete Path Normalization Pattern**
For complex path operations (like in lib/check.js), use this comprehensive pattern:

```javascript
import { fileURLToPath } from 'url';
import path from 'path';

// 1. Convert URI to path (if from external source)
let absolutePath = fileURLToPath(uri);

// 2. Normalize OS-specific separators
absolutePath = path.normalize(absolutePath);

// 3. Generate relative path
let filePath = absolutePath;
if (basePath) {
  const normalizedBase = path.normalize(path.resolve(basePath));
  filePath = path.relative(normalizedBase, absolutePath);

  // 4. Convert to forward slashes for output
  filePath = filePath.split(path.sep).join('/');
}
```

#### 5. **URI to Path Conversion**
When converting file:// URIs to filesystem paths, use `fileURLToPath`:

```javascript
import { fileURLToPath } from 'url';

const uriToPath = (uri) => {
  try {
    return fileURLToPath(uri);  // Handles Windows drive letters correctly
  } catch (error) {
    // Fallback for non-standard URIs
    return uri.replace('file://', '');
  }
};
```

**Why:** On Windows, `file:///C:/path/file.txt` needs to become `C:\path\file.txt`, not `\C:\path\file.txt`.

#### 6. **Third-Party Normalization: `normalize-path`**
For consistent forward-slash conversion, the `normalize-path` package is available:

```javascript
import normalize from 'normalize-path';

const normalizedPath = normalize(windowsPath);  // Always returns forward slashes
```

**Used in:**
- `lib/shouldBeSynced.js` - For pattern matching
- `lib/assets/manifest.js` - For asset path normalization

#### 7. **Pattern Matching on Paths**
Always normalize paths before regex matching:

```javascript
const isAssetsPath = path => {
  const normalizedPath = path.replace(/\\/g, '/');
  return normalizedPath.startsWith('app/assets') ||
         /^modules\/\w+\/public\/assets/.test(normalizedPath);
};
```

### File Permission Patterns

**Key file**: `lib/filePermissions.js`

Windows has no POSIX permission bits. `fs.chmod` there collapses the whole mode onto the
single read-only attribute — clearing every write bit sets it, leaving one set clears it —
so a file asked for `0600` still reports `0666`, and no mode hides it from other accounts.
Permission handling therefore goes through `lib/filePermissions.js` rather than a
`process.platform` check at each call site, exactly as path handling goes through the
helpers above:

```javascript
import { writeFileOwnerOnly, restrictToOwner, permissionsOf, supportsPosixPermissions }
  from '#lib/filePermissions.js';

writeFileOwnerOnly(configPath, JSON.stringify(config, null, 2));  // write a credential file
restrictToOwner(existingPath);                                    // tighten one already there
```

- **`writeFileOwnerOnly(filePath, contents)`** — the only way a file holding credentials
  should be written. Two steps, because neither covers the other: the mode passed to
  `writeFileSync` applies **only on creation**, so it is what stops a new file existing
  world-readable even for an instant, and the follow-up `chmod` is what tightens a file that
  was already there (`.pos` files written by earlier versions are `0644`).
- **`restrictToOwner(filePath)`** — best effort by design. It returns a boolean and never
  throws: the mode of a file just written successfully is not worth failing a command over,
  and on Windows there is nothing to apply. Write errors, by contrast, propagate.
- **`supportsPosixPermissions`** — the single definition of "this platform has mode bits",
  used by implementation **and tests**. A test that asserts a mode guards with
  `test.skipIf(!supportsPosixPermissions)` / `describe.skipIf(...)`; it never re-derives the
  platform question inline.
- **`permissionsOf(filePath)`** — `statSync().mode & 0o777`, so the masking lives in one
  place too. Only meaningful where `supportsPosixPermissions` is true.

Every writer of `.pos` uses this: `lib/environments.js` (`storeEnvironment`),
`lib/twoFactorSession.js` (`persistSession`) and `mcp-min/portal/env-add.js`. A new writer of
any credential-bearing file must too — the file holds a long-lived API token, and one writer
leaving it at `0644` undoes what the others do.

### Testing Cross-Platform Code

When adding or modifying path-handling code:

1. **Test locally if possible** - If on Windows, test Windows behavior; if on Linux, test Linux behavior
2. **Check test output** - Look for path-related test failures in CI (tests run on both platforms)
3. **Verify path separators** - Ensure output paths use forward slashes consistently
4. **Test edge cases:**
   - Paths with spaces
   - Deeply nested paths
   - Paths at root level
   - Module paths vs app paths

### Common Mistakes to Avoid

**❌ Hardcoded path separators:**
```javascript
filePath.split('/');  // Breaks on Windows
filePath.includes('/');  // May not work on Windows
```

**❌ String concatenation for paths:**
```javascript
const fullPath = dir + '/' + filename;  // Use path.join() instead
```

**❌ Not normalizing before pattern matching:**
```javascript
if (filePath.startsWith('app/assets'))  // May fail on Windows
// Should be:
if (filePath.replace(/\\/g, '/').startsWith('app/assets'))
```

**❌ Using `path.relative()` without normalizing base:**
```javascript
path.relative(basePath, absolutePath);  // May give incorrect results
// Should normalize both first:
path.relative(path.normalize(path.resolve(basePath)), path.normalize(absolutePath));
```

**❌ Raw `chmod` / mode assertions at the call site:**
```javascript
fs.writeFileSync(configPath, body, { mode: 0o600 });  // no-op on Windows, and only on create
fs.chmodSync(configPath, 0o600);
expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);  // can never hold on Windows
// Should be:
writeFileOwnerOnly(configPath, body);
test.skipIf(!supportsPosixPermissions)('...', () => expect(permissionsOf(configPath)).toBe(0o600));
```

### Key Files Demonstrating Best Practices

- **`lib/check.js`** - Comprehensive path normalization for linter output
- **`lib/watch.js`** - API-ready path preparation (`filePathUnixified`)
- **`lib/shouldBeSynced.js`** - Pattern matching with normalized paths
- **`lib/overwrites.js`** - Relative path generation
- **`lib/assets/manifest.js`** - Asset path normalization
- **`lib/filePermissions.js`** - Owner-only writes with a documented Windows no-op

## Network Error Handling (Node.js 22+ fetch / undici)

When `fetch()` fails in Node.js 22+, errors are wrapped in a chain up to 3 levels deep. `apiRequest.js` adds one more wrapper, so in `ServerError.requestHandler` the full chain is:

```
RequestError (pos-cli, apiRequest.js)
  └─ cause: TypeError: 'fetch failed'  (undici)
       └─ cause: NodeAggregateError | Error  (Node.js net.js)
```

**Why `NodeAggregateError`?** Node.js 22 enables Happy Eyeballs by default: when `localhost` resolves to multiple addresses (e.g. `::1` and `127.0.0.1`), all are tried concurrently and failures are collected in a `NodeAggregateError`. Crucially, `NodeAggregateError` **always copies `.code` from `errors[0].code`**, so `err.code === 'ECONNREFUSED'` works on both paths.

**The correct pattern — walk the cause chain recursively:**

```javascript
// lib/ServerError.js
const getNetworkErrorCode = (err, depth = 0) => {
  if (!err || depth > 5) return null;
  if (err.code) return err.code;
  return getNetworkErrorCode(err.cause, depth + 1);
};

// In requestHandler:
const causeCode = getNetworkErrorCode(reason);  // finds code at whatever depth it sits
```

**Why not hardcode `reason.cause?.cause?.code`?** The depth can vary between Node.js versions and platforms. Recursive traversal is robust to that.

**Error codes are cross-platform strings** — `'ECONNREFUSED'`, `'ENOTFOUND'`, `'ETIMEDOUT'` are identical on Linux, macOS, and Windows. Only the numeric `errno` value differs (e.g. `-111` on Linux vs `-4078` on Windows for ECONNREFUSED). Always match on `.code`, never on `errno`.

**Test assertions** for connection-error tests should match what the handler actually outputs:
```javascript
expect(stderr).toMatch(/Could not connect|Request to( the)? server failed/);
//                       ^ correct handling   ^ safe fallback for unknown errors
```

**Key file**: `lib/ServerError.js` — `getNetworkErrorCode` helper + `requestHandler`

## Node.js Version

- **Minimum**: Node.js 22.13.0 — set by the dependencies, not by our own code: `commander` 15 needs
  >=22.12.0 (it is ESM-only and relies on `require(esm)`) and `inquirer` 14 needs ^22.13.0.
- **Recommended**: Node.js 22+
- **Tested on**: 22, 24
- Check enforced by `scripts/check-node-version.js` postinstall hook
