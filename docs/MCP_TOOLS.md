# MCP Tools Documentation

Complete reference guide for all platformOS Model Context Protocol (MCP) tools available in pos-cli MCP server.

**Total Tools**: 30

---

## Table of Contents

1. [MCP over HTTP](#mcp-over-http)
2. [HTTP Transport Security](#http-transport-security)
3. [Tool Selection](#tool-selection)
4. [Authentication](#authentication)
5. [Asynchronous Operations](#asynchronous-operations)
6. [Environment Management](#environment-management)
7. [Logging & Monitoring](#logging--monitoring)
8. [GraphQL & Liquid](#graphql--liquid)
9. [Generators](#generators)
10. [Migrations](#migrations)
11. [Deployment](#deployment)
12. [Data Operations](#data-operations)
13. [Testing](#testing)
14. [Linting](#linting)
15. [File Sync](#file-sync)
16. [Property Uploads](#property-uploads)
17. [Constants](#constants)
18. [Response Patterns](#response-patterns)

---

## MCP over HTTP

The MCP endpoint is `POST /mcp` (MCP Streamable HTTP). It serves protocol revision 2026-07-28 and, statelessly, clients on the 2025 revisions; `GET` and `DELETE` answer `405`, since a stateless endpoint has no session to resume.

```bash
curl -s http://localhost:5910/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' -H 'Mcp-Method: tools/list' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}'
```

On 2026-07-28 every request carries the `_meta` envelope and the `Mcp-Method` (and, for `tools/call`, `Mcp-Name`) header; the server answers `400` with `-32020` when the headers and body disagree, and `-32022` for a revision it does not serve. A request body over 1 MB is refused with `413`, one that is not `application/json` with `415`.

A call that fails is a tool result with `isError: true` whose text is a JSON body — `{"ok":false,"error":{"code":"INVALID_PARAMS","message":…}}` for arguments that do not match the schema, the tool's own code when it reports a failure, `INTERNAL_ERROR` when it throws. Unknown or unexposed tools stay protocol errors (`-32602`).

Tools that only read are published with `annotations.readOnlyHint: true`: `envs-list`, `logs-fetch`, `job-status`, `data-validate`, `constants-list`, `generators-list`, `generators-help`, `migrations-list` and the Partner Portal lookups. `data-clean`, `constants-unset`, `deploy-start` and `sync-file` carry `annotations.destructiveHint: true`, because each can delete something on the instance. `deploy-dry-run` states `annotations.destructiveHint: false`, because it sits beside a tool that is destructive and the specification's default for an absent hint is destructive. Everything else carries no annotation, which clients read as "may change things".

**The endpoints used in the examples below — `GET /`, `GET /tools`, `POST /call`, `POST /call-stream` — are deprecated.** They are the pre-SDK HTTP API, still served and removed in a future major; new clients should speak MCP at `/mcp`.

`--no-http` starts the server without any HTTP listener (stdio only), which is what `pos-cli ai init` writes into client configurations.

### Streaming

A `/mcp` request whose `Accept` includes `text/event-stream` is answered as SSE, and that is where a long call's progress notifications arrive: a tool that reports progress (`job-status` while it waits, `deploy-start`, `logs-fetch`) sends `notifications/progress` for the call's progress token, and a call with a token also gets a heartbeat every five seconds so an idle-timeout does not kill it. An MCP client handles this itself; nothing extra is needed to opt in.

The deprecated `POST /call-stream` is the pre-SDK version of the same idea — one SSE stream per call, framed as `event: data` / `event: done` — and goes at the next major along with the other pre-SDK routes.

## HTTP Transport Security

To run the server for the `curl` examples below, start it with stdin from `/dev/null`:

```bash
pos-cli-mcp </dev/null &
```

A server whose stdin is a pipe treats that pipe closing as its MCP client leaving and exits, so a server started by a script that later closes the pipe would not stay up.

The HTTP transport (the `curl` examples below, port 5910) has **no authentication**. Whoever can send it a request can run every enabled tool — `data-clean`, `deploy-start`, `graphql-exec` — with the platformOS credentials the server resolves (see [Authentication](#authentication)). What stands in for it:

- **Loopback bind.** The server listens on `127.0.0.1` only, so other machines cannot connect.
- **Host/Origin validation.** On every route, before the request body is read, the hostname in `Host` must be `localhost`, `127.0.0.1` or `[::1]` (any port), and so must the hostname in `Origin` if the request has one. Otherwise — including a missing `Host` or `Origin: null` — the answer is `403`:

  ```json
  { "jsonrpc": "2.0", "error": { "code": -32000, "message": "Invalid Origin: evil.example" }, "id": null }
  ```

  This stops web pages from driving the server (DNS rebinding, cross-site requests). It does not stop a program running on the same machine, which can send any headers.

| Variable | Default | Effect |
| --- | --- | --- |
| `MCP_MIN_PORT` | `5910` | Port, `0`–`65535` (`0` picks a free port; the log shows which). |
| `MCP_MIN_HOST` | `127.0.0.1` | Bind address: an IP address, or `localhost`. A non-loopback value such as `0.0.0.0` makes every enabled tool reachable, **without authentication**, by anyone who can reach the port, and the server logs a warning saying so on every start. Use it only where that is acceptable, e.g. a container whose published port is bound to the host's loopback. |
| `MCP_MIN_ALLOWED_HOSTS` | *(none)* | Comma-separated hostnames or IP addresses accepted in `Host`/`Origin` in addition to the loopback names, e.g. `devbox.local,10.0.0.5,[fd00::5]`. No scheme, no port; IPv6 in brackets. Clients that address the server by any other name need their name listed here. |

A malformed value in any of the three stops the server at startup with a message naming it. If the port is already taken, the server logs `HTTP transport not started (EADDRINUSE)` and keeps serving MCP over stdio. A `pos-cli-mcp` started by an older pos-cli listens on **all** interfaces with no Host/Origin checks, and keeps answering on that port until it is stopped — restart MCP clients after upgrading.

---

## Tool Selection

Which tools a server exposes is decided once, when it starts, and is the same on stdio and HTTP for every client:

```
exposed = (tools of --profile  ∪  --include-tools)  −  --exclude-tools  −  tools disabled in tools.config.json
```

| Option | Effect |
| --- | --- |
| `--profile <name>` | Starting set. `full` (default): every tool. `dev`: `check-run`, `logs-fetch`, `liquid-exec`, `graphql-exec`, `envs-list`, `deploy-dry-run`, `deploy-start`, `job-status`, `unit-tests-run`, `tests-run-async`. `none`: no tools. |
| `--include-tools <names>` | Adds tools to the profile — not an allowlist, unlike Gemini CLI's `includeTools`. For an allowlist: `--profile none --include-tools a,b`. |
| `--exclude-tools <names>` | Removes tools. Excluding a tool the profile does not contain is allowed, so one exclude list works with any profile. |

Names are comma-separated and each option can be repeated. Tools are always listed in the same order, whatever order they are named in. A tool that is not exposed is also not callable: `tools/call`, `POST /call` and `POST /call-stream` answer it as an unknown tool (`-32601` / `404`), exactly like a name that matches no tool.

The server does not start — it prints one message and exits 1 before either transport opens — for an unknown profile, an unknown tool name in either option (close matches are suggested), a tool named in both, `--include-tools` naming a tool that `tools.config.json` disables, or a selection that leaves no tools.

```bash
pos-cli-mcp --profile dev </dev/null &
curl -s http://localhost:5910/tools | jq '.tools[].id'
```

`pos-cli mcp-config` takes the same options and prints what they expose, and why each other tool is not exposed (`not in profile`, `excluded`, `disabled in the tools config`); add `--json` for the same report as JSON. Bare `pos-cli-mcp` exposes `full`; `pos-cli ai init` configures `--profile dev`.

---

## Server Instructions

The server returns an `instructions` string on `initialize` and on `server/discover`, which clients generally place in the model's system prompt. It carries the rules that span tools and that no single tool description can state: how credentials resolve, that every tool answers with `ok` and reports failure as `ok:false` in the body rather than as a failed call, that a relative path resolves against the directory the server was started in, and that a call returning a `job_id` is polled with `job-status` and `wait_ms`.

It is built from the tools the server actually exposes, so a section about a tool is absent when that tool is — `--profile dev` is told about `deploy-start` and `tests-run-async`, not about `data-clean`. It names no tool from another MCP server. `pos-cli mcp-config` prints the exact string a given selection produces.

---

## Authentication

This section is about how tools authenticate **to platformOS**. The MCP server does not authenticate its own callers; see [HTTP Transport Security](#http-transport-security).

**A call that can change an instance has to name one.** `env` stays optional — three of the four
call styles below do not pass it — but the last of them, "the first entry in `.pos`", names no
instance at all. When the tool is not `readOnlyHint` and `.pos` holds more than one environment,
that resolution is refused rather than guessed:

```javascript
{
  ok: false,
  error: {
    kind: "input",
    code: "ENV_REQUIRED",
    message: "This call can change an instance and nothing said which one. Pass env - one of: prod, staging. Without it the call would have gone to prod, only because it is first in .pos.",
    details: { environments: ["prod", "staging"], wouldHaveUsed: "prod" }
  }
}
```

Passing `env`, or explicit `url` + `email` + `token`, or exporting `MPKIT_*` all satisfy it. A
single configured environment is not a guess and resolves as before, and tools that only read
(`logs-fetch`, `migrations-list`, `constants-list`) are never refused.

All tools (except `envs-list` and generator tools) support multiple authentication methods with the following precedence:

### Authentication Precedence

1. **Explicit Parameters** (highest priority)
   ```json
   { "url": "https://instance.com", "email": "user@example.com", "token": "auth-token" }
   ```

2. **Named Environment from `.pos` File**
   ```json
   { "env": "staging" }
   ```

   Naming an environment settles it: resolution does **not** fall back to the variables below if
   that name is missing from `.pos`, it fails. The caller said which instance they meant, and
   quietly using another one — because the process happened to inherit `MPKIT_*` pointing
   somewhere else — would be worse than the error.

3. **`MPKIT_*` Environment Variables**
   ```bash
   MPKIT_URL=https://instance.com
   MPKIT_EMAIL=user@example.com
   MPKIT_TOKEN=auth-token
   ```

4. **First Environment in `.pos` File** (lowest priority)

   Reached when a call names no environment and none of the above applies — so on a machine with
   several environments, omitting `env` picks whichever is first in the file. Name the environment
   on anything that writes.

### Error When No Auth Available

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_MISSING",
    "message": "Provide url,email,token or configure .pos / MPKIT_* env vars"
  }
}
```

---

## Asynchronous Operations

### job-status

The status of anything `deploy-start`, `data-import`, `data-export`, `data-clean` or `tests-run-async` started. Each of those returns a `job_id` beside its own fields; this reads it back.

The only way to read back anything a starter began. It replaced six per-operation status tools — one each for a deploy, a deploy wait, a data import, export and clean, and an async test run — which were deprecated in 6.6 and removed in 7.0.

**Tool Name**: `job-status`

**Input Parameters**:
- `job_id` *(string, required)*: the value a starter returned. Opaque — pass it back unchanged.
- `wait_ms` *(integer, optional, 0–120000)*: poll until the job is done or this long has passed, whichever comes first.
- `env` *(string, optional)*: environment name. Must be the instance the job was started on.
- `url` / `email` / `token` *(string, optional)*: explicit credentials.

**Response Format**:
```javascript
{
  ok: true,
  data: {
    job_id: "pjob1_…",
    kind: "deploy",            // deploy | data-import | data-export | data-clean | test-run
    state: "running",          // running | completed | failed
    done: false,               // state != running
    status: "in_progress",     // the instance's own word for it
    error: "…",                // only when state is failed
    result: { … }              // kind-specific: the release and asset phase, the export, the test run
  },
  meta: { startedAt, finishedAt, auth: { url, email, token, source } }
}
```

`completed` means the operation finished, even if what it produced reports failures: a test run with failing assertions is `completed`, because the run did its work. `failed` means the operation itself failed.

**Deploy jobs report two phases.** The release import and the asset upload finish separately, and a deploy that had assets is `completed` only when both are in. `data.result.assets.phase` is one of:

| Phase | Meaning |
|---|---|
| `uploading` | this server is still sending the assets; the instance does not know about them yet |
| `processing` | the manifest arrived and the instance is unpacking them |
| `done` | the instance reported on them (`result.assets.report` when it sent one) |
| `failed` | the upload failed here, or the instance rejected it |
| `none` | the deploy had no assets |
| `unknown` | nobody can say: the server that started the upload is gone, and the instance reports nothing about assets |

**Errors** (all as `{ ok: false, error: { code, message } }`):

| Code | Meaning |
|---|---|
| `INVALID_JOB_ID` | not a `job_id`, or one that has been edited. No request is made. |
| `JOB_INSTANCE_MISMATCH` | the resolved credentials are for a different instance than the job was started on. No request is made. |
| `JOB_NOT_FOUND` | the instance has no such job (404, or the test runner's `not_found`). |
| `JOB_STATUS_ERROR` | the status request itself failed. |
| `CANCELLED` | the client cancelled the call. |

**Example Usage**:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "job-status",
    "params": { "job_id": "pjob1_…", "wait_ms": 30000 }
  }'
```

**Use Case**: poll one operation, whatever kind it is, without learning a status tool per kind.

**On the `job_id`**: it carries the kind, the id the instance gave the job, the instance origin, and the flags that kind needs (a data export's ZIP flag; whether a deploy had assets). It is self-contained rather than a key into this server's memory, because MCP clients restart stdio servers while the agent keeps its conversation — with a table, every restart would answer "unknown job". It is parsed strictly on the way back in, and nothing in it decides which credentials are used or which host is called: the instance it names is only ever compared with the one the credentials resolve to.

---

## Environment Management

### envs-list

List all configured environments from `.pos` configuration file.

**Tool Name**: `envs-list`

**Input Parameters**:
- None (empty object `{}`)

**Response Format**:
```javascript
{
  environments: [
    { name: "staging", url: "https://staging.example.com" },
    { name: "production", url: "https://prod.example.com" }
  ]
}
```

**Use Case**: Discover available environments before connecting to one.

---

## Logging & Monitoring

### logs-fetch

Fetch recent logs from a platformOS instance in batches. Pagination supported via `lastId`.

**Tool Name**: `logs-fetch`

**Input Parameters**:
- `env` *(string, optional)*: Environment name from `.pos` config
- `url` *(string, optional)*: Instance URL (alternative to `env`)
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `lastId` *(string, optional)*: Starting log ID for pagination (default: `'0'`)
- `limit` *(integer, optional)*: Maximum logs to fetch (1-10000)

**Response Format**:
```javascript
{
  logs: [
    { id: "1001", timestamp: "2025-01-23T10:30:45Z", level: "info", message: "..." },
    { id: "1002", timestamp: "2025-01-23T10:31:00Z", level: "error", message: "..." }
  ],
  lastId: "1002",
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:31:30Z",
    count: 2,
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Example Usage**:
```bash
# Fetch first 100 logs
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "logs-fetch",
    "params": {
      "env": "staging",
      "limit": 100,
      "lastId": "0"
    }
  }'

# Fetch next batch starting from previous lastId
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "logs-fetch",
    "params": {
      "env": "staging",
      "limit": 100,
      "lastId": "1002"
    }
  }'
```

**Use Case**: Retrieve historical logs for debugging and monitoring.

---

## GraphQL & Liquid

### graphql-exec

Execute GraphQL queries and mutations on a platformOS instance.

**Tool Name**: `graphql-exec`

**Input Parameters**:
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `query` *(string, required)*: GraphQL query or mutation string
- `variables` *(object, optional)*: GraphQL variables

**Response Format**:
```javascript
{
  success: true,
  result: {
    data: {
      users: [
        { id: "1", name: "Alice", email: "alice@example.com" },
        { id: "2", name: "Bob", email: "bob@example.com" }
      ]
    }
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:02Z",
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Example Usage**:
```bash
# Query users
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "graphql-exec",
    "params": {
      "env": "staging",
      "query": "{ users { id name email } }"
    }
  }'

# Mutation with variables
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "graphql-exec",
    "params": {
      "env": "staging",
      "query": "mutation CreateUser($email: String!) { create_user(user: { email: $email }) { id } }",
      "variables": { "email": "newuser@example.com" }
    }
  }'
```

**Use Case**: Execute custom GraphQL queries and mutations for data operations.

---

### liquid-exec

Render Liquid templates on a platformOS instance.

**Tool Name**: `liquid-exec`

**Input Parameters**:
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `template` *(string, required)*: Liquid template string
- `locals` *(object, optional)*: Template variables

**Response Format**:
```javascript
{
  success: true,
  result: "Hello Alice! Your score is 42.",
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:01Z",
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Error Response**:
```javascript
{
  ok: false,
  error: {
    kind: "instance",
    code: "LIQUID_EXEC_ERROR",
    message: "Liquid error: undefined variable name",
    details: { error: "Liquid error: undefined variable name" }
  }
}
```

**Example Usage**:
```bash
# Simple template
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "liquid-exec",
    "params": {
      "env": "staging",
      "template": "Hello {{ name }}!",
      "locals": { "name": "Alice" }
    }
  }'

# Template with logic
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "liquid-exec",
    "params": {
      "env": "staging",
      "template": "{% if score >= 50 %}Passed{% else %}Failed{% endif %}",
      "locals": { "score": 75 }
    }
  }'
```

**Use Case**: Test Liquid template rendering and behavior.

---

## Generators

### generators-list

List all available yeoman generators in the project.

**Tool Name**: `generators-list`

**Input Parameters**:
- None (empty object `{}`)

**Response Format**:
```javascript
{
  generators: [
    {
      path: "modules/core/generators/model",
      name: "model",
      required: ["name"],
      optional: ["fields", "properties"]
    },
    {
      path: "modules/core/generators/command",
      name: "command",
      required: ["name"],
      optional: []
    }
  ]
}
```

**Example Usage**:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "generators-list", "params": {}}'
```

**Use Case**: Discover available generators before running one.

---

### generators-help

Show detailed help for a specific generator.

**Tool Name**: `generators-help`

**Input Parameters**:
- `generatorPath` *(string, required)*: Path like `modules/core/generators/<name>`

**Response Format**:
```javascript
{
  name: "model",
  usage: "pos-cli generate modules/core/generators/model <name> [options]",
  description: "Generate a data model",
  requiredArgs: ["name"],
  optionsTable: "[--force] [--namespace=...] [--fields=...]",
  optionsDetails: [
    { flag: "--force", description: "Overwrite existing files" },
    { flag: "--namespace=STR", description: "Model namespace" },
    { flag: "--fields=STR", description: "Comma-separated fields" }
  ]
}
```

**Example Usage**:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "generators-help",
    "params": { "generatorPath": "modules/core/generators/model" }
  }'
```

**Use Case**: Get help on how to use a specific generator.

---

### generators-run

Run a yeoman generator with arguments and options.

**Tool Name**: `generators-run`

**Input Parameters**:
- `generatorPath` *(string, required)*: Path like `modules/core/generators/<name>`
- `args` *(array of strings, required)*: Positional arguments (order matters)
- `options` *(object, optional)*: Generator options (e.g., `--name=value`)
- `requireArgs` *(boolean, optional, default: true)*: Validate required arguments

**Response Format**:
```javascript
{
  success: true,
  result: {
    createdFiles: ["app/models/user.liquid"],
    message: "Model user created successfully"
  }
}
```

**Error Response**:
```javascript
{
  ok: false,
  error: {
    kind: "input",
    code: "MISSING_REQUIRED_ARGUMENTS",
    message: "Missing required args: name",
    details: { required: ["name"] }
  }
}
```

**Example Usage**:
```bash
# Generate a model
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "generators-run",
    "params": {
      "generatorPath": "modules/core/generators/model",
      "args": ["user"],
      "options": { "fields": "name,email,phone" }
    }
  }'
```

**Use Case**: Generate code scaffolds for models, pages, commands, etc.

---

## Migrations

### migrations-list

List all migrations deployed to a platformOS instance.

**Tool Name**: `migrations-list`

**Input Parameters**:
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token

**Response Format**:
```javascript
{
  ok: true,
  data: {
    migrations: [
      { id: "1234567890", name: "1234567890_create_users", state: "executed", error_messages: null },
      { id: "1234567891", name: "1234567891_add_profile", state: "executed", error_messages: null },
      { id: "1234567892", name: "1234567892_add_preferences", state: "pending", error_messages: [] }
    ],
    raw: { /* the instance's own response */ }
  },
  meta: { ... }
}
```

**Example Usage**:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "migrations-list",
    "params": { "env": "staging" }
  }'
```

**Use Case**: Check migration status and history.

---

### migrations-generate

Generate a new migration on the server and write local file.

**Tool Name**: `migrations-generate`

**Input Parameters**:
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `name` *(string, required)*: Base name without timestamp (e.g., `add_user_fields`)
- `skipWrite` *(boolean, optional, default: false)*: Don't create local file

**Response Format**:
```javascript
{
  ok: true,
  data: {
    name: "1674403200_add_user_fields",
    bodyLength: 156,
    filePath: "app/migrations/1674403200_add_user_fields.liquid",
    raw: { /* the instance's own response */ }
  },
  meta: { ... }
}
```

**Example Usage**:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "migrations-generate",
    "params": {
      "env": "staging",
      "name": "add_user_fields"
    }
  }'
```

**Use Case**: Generate new migrations with auto-generated timestamps.

---

### migrations-run

Execute a specific migration on the server.

**Tool Name**: `migrations-run`

**Input Parameters**:
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `timestamp` *(string, optional)*: Migration timestamp
- `name` *(string, optional)*: Full migration name without `.liquid`

**Note**: Provide either `timestamp` or `name` (not both)

**Response Format**:
```javascript
{
  ok: true,
  data: {
    name: "1234567890_add_user_fields",
    state: "executed",
    raw: { /* the instance's own response */ }
  },
  meta: { ... }
}
```

**Example Usage**:
```bash
# By name
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "migrations-run",
    "params": {
      "env": "staging",
      "name": "1674403200_add_user_fields"
    }
  }'
```

**Use Case**: Execute pending migrations.

---

## Deployment

### deploy-dry-run

What a deploy would change on an instance, applying nothing. A deploy that is not partial is the
whole intended state of the instance — **every file missing from the build is deleted there** — and
this is the only way to see that list before causing it.

It is a separate tool rather than a flag on `deploy-start` so that no argument to it can apply a
deploy: the request always carries `dry_run`. It is annotated `destructiveHint: false` and
deliberately **not** `readOnlyHint`, because it does have effects — the API records a release, and
the archive is written to `tmp/release-dry-run.zip` (its own path, so it cannot overwrite the
archive a concurrent `deploy-start` is streaming).

**Tool Name**: `deploy-dry-run`

**Input Parameters**:
- `env` *(string, optional)*: Environment name
- `url` / `email` / `token` *(string, optional)*: Explicit credentials
- `partial` *(boolean, optional, default: false)*: Report the deploy that leaves missing files in place

**Response Format**:
```javascript
{
  ok: true,
  data: {
    applied: false,
    releaseId: "rel-1",
    partial: false,
    deleted:  { count: 2, files: ["views/pages/old.liquid", "graphql/gone.graphql"] },
    upserted: { count: 12, files: ["views/pages/index.liquid", "..."] },
    skipped:  { count: 1, files: ["graphql/unchanged.graphql"] },
    byCategory: {
      Liquid: { upserted: {...}, deleted: {...}, skipped: {...} },
      Asset:  { upserted: {...}, deleted: {...}, skipped: {...} }
    },
    assets: { state: "validated", count: 42 },
    archive: { path: "./tmp/release-dry-run.zip", fileCount: 156 }
  },
  meta: { ... }
}
```

`deleted`, `upserted` and `skipped` are totals across every category, so an agent can branch on
`data.deleted.count` without walking the report. Each carries `count` and `files` separately
because the API answers some categories with a count rather than the paths; `count` is right either
way, and `files` is empty when it was not given them.

`assets.state` is one of `none` (the project has no assets), `validated` (the manifest was checked,
and its verdict is the `Asset` category), `failed` (the asset phase rejected it, with `error`),
`not_reported` (nothing was checked — an API that does not report on assets, or a release the
instance gave no id for) or `still_validating` (the 60-second wait ended first — the file report
above it is complete regardless). `count` is the number of asset files found locally, so `none`
and `not_reported` are never confused: `none` always carries `count: 0`. The manifest is sent so the API can
validate it against the dry-run release; **nothing is uploaded to S3**.

### deploy-start

Deploy to a platformOS instance. Creates archive from `app/` and `modules/` directories, uploads it, and deploys assets to S3.

**Tool Name**: `deploy-start`

**Input Parameters**:
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `partial` *(boolean, optional, default: false)*: Partial deploy (doesn't remove missing files)

**Response Format**:
```javascript
{
  ok: true,
  data: {
    id: "abc123def456",
    job_id: "...",
    status: "processing",
    archive: { path: "./tmp/release.zip", fileCount: 156 },
    assets: { count: 42, status: "deploying_in_background" },
    params: { partial: false }
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:05Z",
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" },
    params: { partial: false }
  }
}
```

**Example Usage**:
```bash
# Full deploy
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "deploy-start",
    "params": { "env": "staging", "partial": false }
  }'

# Partial deploy (doesn't remove files)
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "deploy-start",
    "params": { "env": "staging", "partial": true }
  }'
```

**Use Case**: Deploy code to a platformOS instance.

---

## Data Operations

### data-import

Start a data import from JSON file, JSON object, or ZIP archive.

**Tool Name**: `data-import`

**Input Parameters** (exactly one data source required):
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `filePath` *(string, optional)*: Path to JSON or ZIP file
- `jsonData` *(object, optional)*: JSON data to import directly
- `zipFileUrl` *(string, optional)*: Remote ZIP file URL
- `validate` *(boolean, optional)*: Check the records against the project schema first
- `appPath` *(string, optional)*: Project directory holding the schema files
- `strictTypes` *(boolean, optional)*: Fail when a value does not match its schema type
- `strictProperties` *(boolean, optional)*: Fail on properties the schema does not define

**Response Format**:
```javascript
{
  ok: true,
  data: {
    id: "import-123",
    status: "processing",
    isZip: false
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:02Z",
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Example Usage**:
```bash
# Import from file
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "data-import",
    "params": {
      "env": "staging",
      "filePath": "./export.json"
    }
  }'

# Import from JSON object
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "data-import",
    "params": {
      "env": "staging",
      "jsonData": {
        "users": [
          { "external_id": "1", "name": "Alice", "email": "alice@example.com" },
          { "external_id": "2", "name": "Bob", "email": "bob@example.com" }
        ]
      }
    }
  }'

# Import from remote ZIP
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "data-import",
    "params": {
      "env": "staging",
      "zipFileUrl": "https://example.com/backup.zip"
    }
  }'
```

**Use Case**: Bulk import data to a platformOS instance.

---

### data-export

Start a data export from a platformOS instance.

**Tool Name**: `data-export`

**Input Parameters**:
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `exportInternalIds` *(boolean, optional, default: false)*: Use internal IDs instead of external_id
- `zip` *(boolean, optional, default: false)*: Export as ZIP archive

**Response Format**:
```javascript
{
  ok: true,
  data: {
    id: "export-456",
    status: "processing",
    isZip: false
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:02Z",
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Example Usage**:
```bash
# Export as JSON
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "data-export",
    "params": {
      "env": "staging",
      "zip": false
    }
  }'

# Export as ZIP with internal IDs
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "data-export",
    "params": {
      "env": "staging",
      "zip": true,
      "exportInternalIds": true
    }
  }'
```

**Use Case**: Backup data from a platformOS instance.

---

### data-clean

Start a destructive data clean operation. Requires confirmation string.

**Tool Name**: `data-clean`

**⚠️ WARNING**: This is a destructive operation. Requires explicit confirmation.

**Input Parameters**:
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `confirmation` *(string, required)*: Must be exactly `"CLEAN DATA"`
- `includeSchema` *(boolean, optional, default: false)*: Also remove pages, schemas, etc.

**Response Format**:
```javascript
{
  ok: true,
  data: {
    id: "clean-789",
    status: "processing",
    includeSchema: false
  },
  warning: "This operation is irreversible. All data has been removed from the instance.",
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:02Z",
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Error on Wrong Confirmation**:
```javascript
{
  ok: false,
  error: {
    kind: "input",
    code: "CONFIRMATION_REQUIRED",
    message: "Confirmation text must be exactly \"CLEAN DATA\". This is a destructive operation.",
    details: { expected: "CLEAN DATA", received: "CLEAN" }
  }
}
```

**Example Usage**:
```bash
# Clean data only
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "data-clean",
    "params": {
      "env": "staging",
      "confirmation": "CLEAN DATA",
      "includeSchema": false
    }
  }'

# Clean data AND schema
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "data-clean",
    "params": {
      "env": "staging",
      "confirmation": "CLEAN DATA",
      "includeSchema": true
    }
  }'
```

**Use Case**: Reset instance for testing or troubleshooting.

---

## Testing

### unit-tests-run

Run platformOS tests on an instance.

**Tool Name**: `unit-tests-run`

**Input Parameters**:
- `env` *(string, optional)*: Environment name from `.pos` config
- `url` *(string, optional)*: Instance URL (alternative to `env`)
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `path` *(string, optional)*: Test path filter (e.g., `tests/users`). Calls `/_tests/run?formatter=text&path=...`
- `name` *(string, optional)*: Test name filter (e.g., `create_user_test`). Calls `/_tests/run?formatter=text&name=...`

**Note**: Both `path` and `name` can be combined to narrow down test selection.

**Response Format**:
```javascript
{
  ok: true,
  data: {
    tests: [
      { name: "create_user_test", description: "Creates a new user", passed: true },
      { name: "delete_user_test", description: "Deletes a user", passed: true },
      { name: "invalid_email_test", description: "Rejects invalid email", passed: false, error: "Expected false, got true" }
    ],
    summary: {
      assertions: 24,
      failed: 1,
      timeMs: 2345,
      totalErrors: 1
    },
    passed: 2,
    totalTests: 3
  },
  raw: "...",  // raw test output
  meta: {
    url: "https://...",
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:02Z",
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Example Usage**:
```bash
# Run all tests
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "unit-tests-run",
    "params": { "env": "staging" }
  }'

# Run tests in specific path
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "unit-tests-run",
    "params": {
      "env": "staging",
      "path": "tests/users"
    }
  }'

# Run specific test by path and name
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "unit-tests-run",
    "params": {
      "env": "staging",
      "path": "tests/users",
      "name": "create_user_test"
    }
  }'

# Run test by name only
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "unit-tests-run",
    "params": {
      "env": "staging",
      "name": "create_user_test"
    }
  }'
```

**API Endpoint Called**:
- All tests: `/_tests/run?formatter=text`
- With path: `/_tests/run?formatter=text&path=tests%2Fusers`
- With name: `/_tests/run?formatter=text&name=create_user_test`
- With both: `/_tests/run?formatter=text&path=tests%2Fusers&name=create_user_test`

**Use Case**: Execute platformOS tests to verify functionality.

---

## Linting

### check-run

Run the platformos-check linter over an app directory and report offences grouped by file. Read the `check` code on each offence rather than a pass/fail verdict: severity is reported per offence, and a clean run is not a promise that a deploy will succeed.

**Tool Name**: `check-run`

**Input Parameters**:
- `appPath` *(string, optional)*: Path to the platformOS app directory to check (default: current directory)
- `autoFix` *(boolean, optional, default: false)*: Fix what can be fixed, then re-check and return what remains

**Response**:
```json
{
  "ok": true,
  "data": {
    "offenseCount": 3,
    "fileCount": 2,
    "errorCount": 1,
    "warningCount": 2,
    "infoCount": 0,
    "filesChecked": 128,
    "autoFixed": false,
    "files": [
      {
        "path": "app/views/pages/index.liquid",
        "offenses": [
          {
            "check": "UnknownFilter",
            "severity": "error",
            "start_row": 12,
            "start_column": 4,
            "end_row": 12,
            "end_column": 22,
            "message": "Unknown filter 'md5'"
          }
        ],
        "errorCount": 1,
        "warningCount": 0,
        "infoCount": 0
      }
    ]
  },
  "meta": { "startedAt": "...", "finishedAt": "...", "appPath": "/abs/path" }
}
```

**Errors**: `PATH_NOT_FOUND` and `NOT_A_DIRECTORY` for an `appPath` that is not a directory on this machine; `MISSING_DEPENDENCY` if the linter cannot be loaded from the installation.

**Example Usage**:
```bash
# Lint the current directory
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "check-run",
    "params": {}
  }'

# Lint a specific app directory and fix what can be fixed
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "check-run",
    "params": {
      "appPath": ".",
      "autoFix": true
    }
  }'
```

**Use Case**: Find violations before deploying, and fix the mechanical ones. `autoFix` writes to the files it fixes, so the positions in a previous result no longer apply afterwards.

---

## File Sync

### sync-file

Sync a single file to a platformOS instance (upload or delete).

**Tool Name**: `sync-file`

**Input Parameters** (required: filePath):
- `filePath` *(string, required)*: Path to file (relative to project root)
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `op` *(string, optional, enum: ["upload", "delete"])*: Operation (auto-detected if not provided)
- `dryRun` *(boolean, optional, default: false)*: Simulate without performing
- `confirmDelete` *(boolean, optional, default: false)*: Required to confirm deletion

**Supported Directories**:
- `app/` - Application files
- `modules/*/` - Module files
- `marketplace_builder/` - Legacy directory

**Response Format**:
```javascript
{
  ok: true,
  file: {
    path: "app/views/index.html",
    size: 1234,
    operation: "upload",
    isAsset: false,
    wasIgnored: false
  },
  server: {
    response: { success: true },
    timingMs: 234
  },
  meta: {
    dryRun: false,
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:00Z",
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Error on Missing Confirmation**:
```javascript
{
  ok: false,
  error: {
    kind: "input",
    code: "DELETE_PROTECTED",
    message: "confirmDelete=true is required to delete",
    details: { operation: "delete", file: { localPath: "app/views/pages/index.liquid" } }
  }
}
```

**Example Usage**:
```bash
# Upload a file
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "sync-file",
    "params": {
      "env": "staging",
      "filePath": "app/views/index.html",
      "op": "upload"
    }
  }'

# Delete a file (requires confirmation)
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "sync-file",
    "params": {
      "env": "staging",
      "filePath": "app/views/old.html",
      "op": "delete",
      "confirmDelete": true
    }
  }'

# Dry run upload (simulate without performing)
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "sync-file",
    "params": {
      "env": "staging",
      "filePath": "app/views/index.html",
      "op": "upload",
      "dryRun": true
    }
  }'
```

**Use Case**: Sync individual files without full deployment.

---

## Property Uploads

### uploads-push

Upload a ZIP file containing property uploads (files referenced by upload-type properties) to a platformOS instance. This is the MCP equivalent of `pos-cli uploads push`.

**Tool Name**: `uploads-push`

**Input Parameters**:
- `env` *(string, required)*: Environment name from `.pos` config
- `filePath` *(string, required)*: Path to ZIP file with uploads

**Response Format**:
```javascript
{
  ok: true,
  data: {
    instanceId: "abc123",
    filePath: "/path/to/uploads.zip",
    accessUrl: "https://cdn.platformos.com/instances/abc123/property_uploads/data.public_property_upload_import.zip"
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:05Z"
  }
}
```

**Error Responses**:
```javascript
// File not found
{
  ok: false,
  error: { kind: "not_found", code: "FILE_NOT_FOUND", message: "File not found: /path/to/uploads.zip" }
}

// Upload refused — the kind follows the status, so an expired token is `auth`, not a retry
{
  ok: false,
  error: { kind: "auth", code: "UPLOAD_FAILED", message: "Error details..." }
}
```

**Example Usage**:
```bash
# Upload a ZIP file
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "uploads-push",
    "params": {
      "env": "staging",
      "filePath": "./uploads.zip"
    }
  }'

# Upload from seed directory
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "uploads-push",
    "params": {
      "env": "production",
      "filePath": "./seed/images.zip"
    }
  }'
```

---

### Complete Uploads Tutorial

This tutorial explains how to use `uploads-push` to import files that will be referenced by upload-type properties in your platformOS data.

#### Step 1: Define Upload Properties in Your Schema

First, create a table with an upload-type property in your platformOS app:

**`app/schema/photo.yml`**:
```yaml
name: photo
properties:
  - name: title
    type: string
  - name: image
    type: upload
    options:
      content_length:
        min: 0
        max: 5242880  # 5MB max
      versions:
        - name: thumb
          output:
            format: webp
            quality: 80
            resize:
              width: 150
              height: 150
              fit: cover
        - name: medium
          output:
            format: webp
            quality: 85
            resize:
              width: 800
              height: 600
              fit: inside
              without_enlargement: true
```

#### Step 2: Prepare Your ZIP File Structure

Create a ZIP file with your upload files organized in directories:

```
uploads.zip
└── photo_images/
    ├── sunset.jpg
    ├── mountain.png
    └── beach.webp
```

The directory name (`photo_images`) will be used as a reference path in your data import.

**Creating the ZIP**:
```bash
# From your project root
mkdir -p seed/photo_images
cp /path/to/your/images/* seed/photo_images/
cd seed && zip -r ../uploads.zip photo_images/
```

#### Step 3: Push Uploads to platformOS

Use the `uploads-push` tool to upload the ZIP file:

```bash
# Using MCP server
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "uploads-push",
    "params": {
      "env": "staging",
      "filePath": "./uploads.zip"
    }
  }'
```

Or using the CLI directly:
```bash
pos-cli uploads push staging --path=uploads.zip
```

#### Step 4: Import Data Referencing the Uploads

After uploading files, import your data records that reference them.

**`seed/data.json`**:
```json
{
  "records": [
    {
      "id": "photo-1",
      "type": "photo",
      "properties": {
        "title": "Beautiful Sunset",
        "image": {
          "path": "photo_images/sunset.jpg",
          "file_name": "sunset.jpg",
          "extension": ".jpg",
          "versions": {
            "thumb": "photo_images/sunset.jpg",
            "medium": "photo_images/sunset.jpg"
          }
        }
      }
    },
    {
      "id": "photo-2",
      "type": "photo",
      "properties": {
        "title": "Mountain View",
        "image": {
          "path": "photo_images/mountain.png",
          "file_name": "mountain.png",
          "extension": ".png",
          "versions": {
            "thumb": "photo_images/mountain.png",
            "medium": "photo_images/mountain.png"
          }
        }
      }
    }
  ]
}
```

Import the data:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "data-import",
    "params": {
      "env": "staging",
      "filePath": "./seed/data.json"
    }
  }'
```

#### Step 5: Access Uploaded Files

After import, access your files using the `property_upload` GraphQL argument:

**GraphQL Query**:
```graphql
query GetPhotos {
  records(
    per_page: 10
    filter: { table: { value: "photo" } }
  ) {
    results {
      id
      title: property(name: "title")
      image: property_upload(name: "image") {
        url
        versions
      }
    }
  }
}
```

**Response**:
```json
{
  "data": {
    "records": {
      "results": [
        {
          "id": "photo-1",
          "title": "Beautiful Sunset",
          "image": {
            "url": "https://cdn.platformos.com/.../sunset.jpg",
            "versions": {
              "thumb": "https://cdn.platformos.com/.../sunset_thumb.webp",
              "medium": "https://cdn.platformos.com/.../sunset_medium.webp"
            }
          }
        }
      ]
    }
  }
}
```

#### Complete Workflow Script

Here's a complete workflow combining all steps:

```bash
#!/bin/bash
set -e

ENV="staging"
MCP_URL="http://localhost:5910/call"

echo "=== Step 1: Push uploads ==="
curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"tool\": \"uploads-push\",
    \"params\": {
      \"env\": \"$ENV\",
      \"filePath\": \"./uploads.zip\"
    }
  }" | jq .

echo ""
echo "=== Step 2: Import data ==="
IMPORT_RESULT=$(curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"tool\": \"data-import\",
    \"params\": {
      \"env\": \"$ENV\",
      \"filePath\": \"./seed/data.json\"
    }
  }")

echo "$IMPORT_RESULT" | jq .
JOB_ID=$(echo "$IMPORT_RESULT" | jq -r '.data.id')

echo ""
echo "=== Step 3: Wait for import ==="
while true; do
  STATUS=$(curl -s -X POST $MCP_URL \
    -H "Content-Type: application/json" \
    -d "{
      \"tool\": \"data-import-status\",
      \"params\": {
        \"env\": \"$ENV\",
        \"jobId\": \"$JOB_ID\"
      }
    }")

  STATE=$(echo "$STATUS" | jq -r '.data.status')
  echo "Status: $STATE"

  if [ "$STATE" = "done" ] || [ "$STATE" = "failed" ]; then
    echo "$STATUS" | jq .
    break
  fi

  sleep 2
done

echo ""
echo "=== Done! ==="
```

#### Tips and Best Practices

1. **File Organization**: Use meaningful directory names that match your property names for clarity.

2. **File Size Limits**: Check your upload property's `content_length` options to ensure files don't exceed limits.

3. **Supported Formats**: For images, platformOS supports common formats (JPEG, PNG, WebP, GIF). The `versions` option can convert between formats.

4. **Version Paths**: In import data, version paths typically point to the same source file - platformOS generates the versions automatically based on your schema options.

5. **Order Matters**: Always push uploads BEFORE importing data that references them.

6. **Idempotency**: Re-running `uploads-push` with the same ZIP will overwrite existing files at the same paths.

---

## Constants

Manage instance constants (environment variables stored on the platformOS instance).

### constants-list

List all constants configured on a platformOS instance.

**Tool Name**: `constants-list`

**Input Parameters**:
- `env` *(string, required)*: Environment name from `.pos` config

**Response Format**:
```javascript
{
  ok: true,
  data: {
    constants: [
      { name: "API_KEY", value: "abc123...", updatedAt: "2025-01-23T10:30:00Z" },
      { name: "SECRET_TOKEN", value: "xyz789...", updatedAt: "2025-01-22T08:00:00Z" }
    ],
    count: 2
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:01Z"
  }
}
```

**Example Usage**:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "constants-list",
    "params": { "env": "staging" }
  }'
```

---

### constants-set

Set a constant on a platformOS instance. Creates or updates the constant.

**Tool Name**: `constants-set`

**Input Parameters**:
- `env` *(string, required)*: Environment name from `.pos` config
- `name` *(string, required)*: Name of the constant (e.g., `API_KEY`)
- `value` *(string, required)*: Value of the constant

**Response Format**:
```javascript
{
  ok: true,
  data: {
    name: "API_KEY",
    value: "new-value-here"
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:01Z"
  }
}
```

**Example Usage**:
```bash
# Set a new constant
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "constants-set",
    "params": {
      "env": "staging",
      "name": "API_KEY",
      "value": "sk-1234567890"
    }
  }'

# Update an existing constant
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "constants-set",
    "params": {
      "env": "production",
      "name": "STRIPE_KEY",
      "value": "pk_live_xxxxx"
    }
  }'
```

---

### constants-unset

Delete a constant from a platformOS instance.

**Tool Name**: `constants-unset`

**Input Parameters**:
- `env` *(string, required)*: Environment name from `.pos` config
- `name` *(string, required)*: Name of the constant to delete

**Response Format**:
```javascript
{
  ok: true,
  data: {
    name: "OLD_KEY",
    deleted: true
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:01Z"
  }
}
```

**Example Usage**:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "constants-unset",
    "params": {
      "env": "staging",
      "name": "DEPRECATED_KEY"
    }
  }'
```

**Note**: If the constant doesn't exist, the response will have `deleted: false`.

---

## Response Patterns

Every tool answers in one shape. A tool returns the data it produced or throws; `ok`, the error
body and `meta` are built in one place (`mcp-min/run-tool.js`) for every transport, and the
protocol's `isError` is derived from `ok === false`. A tool cannot report a failure any other way.

### Standard Success Response

```javascript
{
  ok: true,
  data: {
    // Tool-specific data
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:02Z",
    auth: {
      url: "https://instance.platformos.net",
      email: "user@example.com",
      token: "abc...xyz",  // First 3 and last 3 chars, masked
      source: ".pos(staging)"  // Where auth came from
    }
  }
}
```

### Standard Error Response

```javascript
{
  ok: false,
  error: {
    kind: "unavailable",          // What to do next; one of the eight below
    code: "ECONNREFUSED",         // Specific, stable, what you branch on
    message: "Human-readable message",
    details: {...}                // Optional: status code, response body, path
  },
  meta: { startedAt: "...", finishedAt: "..." }
}
```

`kind` is a closed set, and each member answers one question — what should the caller do next:

| kind | meaning |
|---|---|
| `input` | the arguments were wrong; change them and call again |
| `not_found` | what the arguments named is not there |
| `auth` | credentials rejected or missing; re-authenticate rather than retry |
| `project` | the project or machine is not ready for this |
| `instance` | the instance ran it and refused; the message says why |
| `unavailable` | nothing was decided; the same call may work later |
| `internal` | a defect in pos-cli |
| `cancelled` | the client stopped the call |

An error a tool does not classify itself is classified from what it carries: a refused connection
or a 5xx is `unavailable`, a 401 or 403 is `auth`, a 404 is `not_found`, another 4xx is `instance`,
and anything else is `internal`.

**A failure of the work is not a failure of the call.** A test run whose assertions failed answers
`ok: true` — the run did what was asked, and the failures are in `data`. So does a `job-status` call
about a job that failed, and a `data-validate` run that found invalid records. `ok: false` means the
tool did not do what was asked.

### Async Job Pattern

Every long-running operation follows the same pattern, whatever it started.

**1. Start it**:
```javascript
POST /call
{
  "tool": "deploy-start",
  "params": {"env": "staging"}
}
```

**2. Take the `job_id` from the response**:
```javascript
{
  "ok": true,
  "data": {"id": "abc123def456", "job_id": "pjob1_…", "status": "ready_for_import"}
}
```

**3. Poll it**:
```javascript
POST /call
{
  "tool": "job-status",
  "params": {"job_id": "pjob1_…"}
}
```

**4. Or wait for it**:
```javascript
POST /call
{
  "tool": "job-status",
  "params": {"job_id": "pjob1_…", "wait_ms": 60000}
}
```

Poll until `done` is true. `wait_ms` is bounded (120 s maximum); reaching the deadline returns the current state with `done: false`, so a long job is a few waits rather than one call that never ends.

---

## Workflow Examples

### Complete Deployment Workflow

```bash
# 1. Start deployment
JOB_ID=$(curl -s -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "deploy-start",
    "params": {"env": "staging"}
  }' | jq -r '.data.job_id')

# 2. Wait for completion — including its assets
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d "{
    \"tool\": \"job-status\",
    \"params\": {
      \"job_id\": \"$JOB_ID\",
      \"wait_ms\": 120000
    }
  }"
```

### Data Migration Workflow

```bash
# 1. Export data from production
EXPORT_ID=$(curl -s -X POST http://localhost:5910/call \
  -d '{
    "tool": "data-export",
    "params": {"env": "production", "zip": true}
  }' | jq -r '.data.id')

# 2. Poll export status
curl -X POST http://localhost:5910/call \
  -d "{
    \"tool\": \"data-export-status\",
    \"params\": {\"env\": \"production\", \"jobId\": \"$EXPORT_ID\", \"isZip\": true}
  }"

# 3. Get ZIP URL and import to staging
ZIP_URL=$(curl -s -X POST http://localhost:5910/call \
  -d "{...}" | jq -r '.data.zipFileUrl')

IMPORT_ID=$(curl -s -X POST http://localhost:5910/call \
  -d "{
    \"tool\": \"data-import\",
    \"params\": {\"env\": \"staging\", \"zipFileUrl\": \"$ZIP_URL\"}
  }" | jq -r '.data.id')

# 4. Poll import status
curl -X POST http://localhost:5910/call \
  -d "{
    \"tool\": \"data-import-status\",
    \"params\": {\"env\": \"staging\", \"jobId\": \"$IMPORT_ID\"}
  }"
```

### Test & Deploy Workflow

```bash
# 1. Run tests
curl -X POST http://localhost:5910/call \
  -d '{"tool": "unit-tests-run", "params": {"env": "staging"}}'

# 2. If tests pass, deploy
curl -X POST http://localhost:5910/call \
  -d '{"tool": "deploy-start", "params": {"env": "staging"}}'
```

---

## Troubleshooting

### Common Errors

| Error Code | Cause | Solution |
|-----------|-------|----------|
| `AUTH_MISSING` | No credentials configured | Set up `.pos` file or environment variables |
| `404` | Endpoint not found | Check instance URL and environment |
| `422` | Feature not supported | Feature may be disabled on server |
| `CONFIRMATION_MISMATCH` | Wrong confirmation string | Use exact string `"CLEAN DATA"` |
| `NOT_SUPPORTED` | Server doesn't support feature | Update server or use different endpoint |

### Debug Mode

Enable verbose logging:

```bash
MCP_MIN_DEBUG=1 pos-cli-mcp
```

The log file is named on the first line the server writes; `DEBUG=1` does the same thing.

### Testing Tools Locally

```bash
# Start the MCP server with its HTTP transport (stdin from /dev/null keeps it running)
pos-cli-mcp </dev/null &

# In another terminal, test a tool
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "envs-list",
    "params": {}
  }'
```

---

## Summary

### The Tools, in the Order Clients See Them

35 are registered, and all of them are exposed by default. `--profile dev` exposes the nine marked below.

What the server deliberately does *not* expose, and why, is recorded in
[docs/MCP_COVERAGE.md](MCP_COVERAGE.md) — one decision per pos-cli capability, held against `bin/`
by `mcp-min/__tests__/cli-coverage.test.js`.

| Group | Tools |
|---|---|
| Environments | `envs-list` (dev), `env-add` |
| Logging | `logs-fetch` (dev) |
| Liquid & GraphQL | `liquid-exec` (dev), `graphql-exec` (dev) |
| Generators | `generators-list`, `generators-help`, `generators-run` |
| Migrations | `migrations-list`, `migrations-generate`, `migrations-run` |
| Jobs | `job-status` (dev) |
| Deployment | `deploy-dry-run` (dev), `deploy-start` (dev) |
| Data | `data-import`, `data-export`, `data-clean`, `data-validate` |
| Testing | `unit-tests-run` (dev), `tests-run-async` (dev) |
| Linting | `check-run` (dev) |
| File sync | `sync-file` |
| Property uploads | `uploads-push` |
| Constants | `constants-list`, `constants-set`, `constants-unset` |
| Partner Portal | `instance-create`, `partners-list`, `partner-get`, `endpoints-list` |


`pos-cli mcp-config` prints this for your own configuration and options, which is the answer to trust if this table ever drifts.

### Tool Locations

Each group lives in its own directory under `mcp-min/`: `logs/`, `liquid/`, `graphql/`, `generators/`, `migrations/`, `jobs/`, `deploy/`, `data/`, `tests/`, `check/`, `sync/`, `uploads/`, `constants/` and `portal/`. Simple tools are defined inline in `mcp-min/tools.js`.

### Registration

Every tool is registered in `mcp-min/tools.js`, which is the registry and nothing else: which of them a server exposes is resolved once at startup from `--profile`, `--include-tools`/`--exclude-tools` and `tools.config.json`, and both transports serve that same set.

---

## See Also

- [platformOS Documentation](https://documentation.platformos.com)
- [The MCP section of the README](../README.md#mcp-server-model-context-protocol) — installing, registering the server with an AI tool, and choosing which tools are exposed
- [mcp-min/README.md](../mcp-min/README.md) — how the server is put together
