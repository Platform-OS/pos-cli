# MCP Tools Documentation

Complete reference guide for all platformOS Model Context Protocol (MCP) tools available in pos-cli MCP server.

**Total Tools**: 26 active tools

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

Tools that only read are published with `annotations.readOnlyHint: true`: `envs-list`, `logs-fetch`, the deploy/data/test status tools, `data-validate`, `constants-list`, `generators-list`, `generators-help`, `migrations-list` and the Partner Portal lookups. Everything else carries no annotation, which clients read as "may change things".

**The endpoints used in the examples below — `GET /`, `GET /tools`, `POST /call`, `POST /call-stream` — are deprecated.** They are the pre-SDK HTTP API, kept working through 6.x and removed at the next major; new clients should speak MCP at `/mcp`.

`--no-http` starts the server without any HTTP listener (stdio only), which is what `pos-cli ai init` writes into client configurations.

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
| `--profile <name>` | Starting set. `full` (default): every tool. `dev`: `check-run`, `logs-fetch`, `liquid-exec`, `graphql-exec`, `envs-list`, `deploy-start`, `job-status`, `unit-tests-run`, `tests-run-async`. `none`: no tools. |
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

## Authentication

This section is about how tools authenticate **to platformOS**. The MCP server does not authenticate its own callers; see [HTTP Transport Security](#http-transport-security).

All tools (except `envs-list` and generator tools) support multiple authentication methods with the following precedence:

### Authentication Precedence

1. **Explicit Parameters** (highest priority)
   ```json
   { "url": "https://instance.com", "email": "user@example.com", "token": "auth-token" }
   ```

2. **Environment Variables**
   ```bash
   MPKIT_URL=https://instance.com
   MPKIT_EMAIL=user@example.com
   MPKIT_TOKEN=auth-token
   ```

3. **Named Environment from `.pos` File**
   ```json
   { "env": "staging" }
   ```

4. **First Environment in `.pos` File** (lowest priority)

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

Replaces `deploy-status`, `deploy-wait`, `data-import-status`, `data-export-status`, `data-clean-status` and `tests-run-async-result`, which are deprecated and removed in the next major release.

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
- `endpoint` *(string, optional)*: Override API base URL
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
- `endpoint` *(string, optional)*: Override API base URL
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
  success: false,
  error: {
    code: "LIQUID_ERROR",
    message: "Syntax error in template",
    details: { line: 5, column: 10 }
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
  success: false,
  error: {
    code: "MISSING_ARGS",
    message: "Missing required arguments",
    required: ["name"]
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
  status: "ok",
  data: {
    migrations: [
      { id: "1234567890", name: "1234567890_create_users", state: "executed" },
      { id: "1234567891", name: "1234567891_add_profile", state: "executed" },
      { id: "1234567892", name: "1234567892_add_preferences", state: "pending", error_messages: [] }
    ]
  }
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
- `endpoint` *(string, optional)*: Override API base URL

**Response Format**:
```javascript
{
  status: "ok",
  data: {
    name: "1674403200_add_user_fields",
    bodyLength: 156,
    filePath: "app/migrations/1674403200_add_user_fields.liquid"
  }
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
- `endpoint` *(string, optional)*: Override API base URL

**Note**: Provide either `timestamp` or `name` (not both)

**Response Format**:
```javascript
{
  status: "ok",
  data: {
    name: "1234567890_add_user_fields",
    status: "executed"
  }
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
    status: "processing"
  },
  archive: {
    path: "./tmp/release.zip",
    fileCount: 156
  },
  assets: {
    count: 42,
    skipped: false
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

### deploy-status

> **Deprecated**, and removed in the next major release. Use [`job-status`](#job-status); it answers from the same code, and a `job_id` also reports the asset phase, which a bare release id cannot.

Get the current status of a deployment.

**Tool Name**: `deploy-status`

**Input Parameters**:
- `id` *(string, required)*: Deployment ID from `deploy-start`
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `endpoint` *(string, optional)*: Override API base URL

**Response Format**:
```javascript
{
  ok: true,
  data: {
    id: "abc123def456",
    status: "processing",
    createdAt: "2025-01-23T10:30:00Z",
    progress: { current: 42, total: 100 }
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:01Z",
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Example Usage**:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "deploy-status",
    "params": {
      "env": "staging",
      "id": "abc123def456"
    }
  }'
```

**Use Case**: Check deployment progress without blocking.

---

### deploy-wait

> **Deprecated**, and removed in the next major release. Use [`job-status`](#job-status) with `wait_ms`, which is bounded; without `maxWaitMs` this one waits with no deadline.

Wait for a deployment to complete. Polls until status is no longer "ready_for_import".

**Tool Name**: `deploy-wait`

**Input Parameters**:
- `id` *(string, required)*: Deployment ID from `deploy-start`
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `intervalMs` *(integer, optional, min: 200, default: 1000)*: Poll interval
- `maxWaitMs` *(integer, optional)*: Maximum wait time before timeout

**Response Format**:
```javascript
{
  ok: true,
  data: {
    id: "abc123def456",
    status: "done",
    completedAt: "2025-01-23T10:30:30Z"
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:31Z"
  }
}
```

**Error on Failure**:
```javascript
{
  ok: false,
  error: {
    code: "DEPLOY_FAILED",
    message: "Deployment failed",
    data: { status: "error", errorMessage: "..." }
  }
}
```

**Example Usage**:
```bash
# Wait for deploy with 2s polls, max 10 minutes
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "deploy-wait",
    "params": {
      "env": "staging",
      "id": "abc123def456",
      "intervalMs": 2000,
      "maxWaitMs": 600000
    }
  }'
```

**Use Case**: Block until deployment completes in automated workflows.

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
- `rawIds` *(boolean, optional, default: false)*: Keep original IDs
- `endpoint` *(string, optional)*: Override API base URL

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

### data-import-status

> **Deprecated**, and removed in the next major release. Use [`job-status`](#job-status); it answers from the same code.

Check the status of a data import job.

**Tool Name**: `data-import-status`

**Input Parameters**:
- `jobId` *(string, required)*: Import job ID from `data-import`
- `isZip` *(boolean, optional, default: false)*: Set to true if import was ZIP
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `endpoint` *(string, optional)*: Override API base URL

**Response Format**:
```javascript
{
  ok: true,
  data: {
    id: "import-123",
    status: "done",
    done: 100,
    pending: 0,
    failed: 0,
    response: { created: 2, updated: 0 }
  },
  meta: { auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" } }
}
```

**Status Values**: `pending`, `processing`, `scheduled`, `done`, `failed`

**Example Usage**:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "data-import-status",
    "params": {
      "env": "staging",
      "jobId": "import-123",
      "isZip": false
    }
  }'
```

**Use Case**: Poll until data import completes.

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
- `endpoint` *(string, optional)*: Override API base URL

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

### data-export-status

> **Deprecated**, and removed in the next major release. Use [`job-status`](#job-status); it answers from the same code.

Check the status of a data export job.

**Tool Name**: `data-export-status`

**Input Parameters**:
- `jobId` *(string, required)*: Export job ID from `data-export`
- `isZip` *(boolean, optional, default: false)*: Set to true if export is ZIP
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `endpoint` *(string, optional)*: Override API base URL

**Response Format**:
```javascript
{
  ok: true,
  data: {
    id: "export-456",
    status: "done",
    done: 100,
    pending: 0,
    failed: 0,
    zipFileUrl: "https://s3.example.com/export.zip",  // if zip: true
    exportedData: {                                     // if zip: false
      users: [...],
      transactables: [...],
      models: [...]
    }
  },
  meta: { auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" } }
}
```

**Status Values**: `pending`, `processing`, `scheduled`, `done`, `failed`

**Example Usage**:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "data-export-status",
    "params": {
      "env": "staging",
      "jobId": "export-456",
      "isZip": false
    }
  }'
```

**Use Case**: Poll until data export completes and retrieve results.

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
- `endpoint` *(string, optional)*: Override API base URL

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
    code: "CONFIRMATION_MISMATCH",
    message: "Confirmation string does not match",
    expected: "CLEAN DATA",
    received: "CLEAN"
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

### data-clean-status

> **Deprecated**, and removed in the next major release. Use [`job-status`](#job-status); it answers from the same code.

Check the status of a data clean operation.

**Tool Name**: `data-clean-status`

**Input Parameters**:
- `jobId` *(string, required)*: Clean job ID from `data-clean`
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: Instance URL
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `endpoint` *(string, optional)*: Override API base URL

**Response Format**:
```javascript
{
  ok: true,
  data: {
    id: "clean-789",
    status: "done",
    done: 100,
    pending: 0,
    failed: 0,
    response: { removed: true }
  },
  meta: { auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" } }
}
```

**Status Values**: `pending`, `processing`, `scheduled`, `done`, `failed`

**Example Usage**:
```bash
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "data-clean-status",
    "params": {
      "env": "staging",
      "jobId": "clean-789"
    }
  }'
```

**Use Case**: Poll until data clean completes.

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

### check

Run platformos-check to lint and analyze the app for best practice violations. Checks Liquid, JSON, YAML, and HTML files.

**Tool Name**: `check`

**Input Parameters**:
- `appPath` *(string, optional)*: Path to the platformOS app (default: current directory)
- `format` *(string, optional, enum: ['text', 'json'], default: 'json')*: Output format
- `category` *(array of strings, optional)*: Only run checks matching these categories (can specify multiple)
- `excludeCategory` *(array of strings, optional)*: Exclude checks matching these categories (can specify multiple)
- `autoCorrect` *(boolean, optional, default: false)*: Automatically fix offenses
- `failLevel` *(string, optional, enum: ['error', 'suggestion', 'style'])*: Minimum severity level to fail with error code
- `config` *(string, optional)*: Path to custom `.platformos-check.yml` config file
- `list` *(boolean, optional, default: false)*: List enabled checks without running them
- `print` *(boolean, optional, default: false)*: Print active config to STDOUT

**Available Check Categories**:
- `:liquid` - Liquid template checks
- `:graphql` - GraphQL checks
- `:yaml` - YAML validation
- `:html` - HTML checks
- `:performance` - Performance-related checks
- `:translation` - Translation key checks

**Response Format** (for normal check run):
```javascript
{
  ok: true,
  data: {
    result: {
      offenses: [
        {
          file: "app/views/index.liquid",
          line: 5,
          column: 2,
          message: "Space inside braces",
          severity: "style",
          check: "SpaceInsideBraces"
        }
      ],
      summary: {
        total: 5,
        errors: 2,
        warnings: 1,
        suggestions: 2
      }
    },
    format: "json",
    appPath: ".",
    autoCorrect: false
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:05Z"
  }
}
```

**Response Format** (when list=true):
```javascript
{
  ok: true,
  data: {
    result: "ConvertIncludeToRender:\n  severity: suggestion\n  categories: [:liquid]\n  ...",
    format: "json",
    listChecks: true
  },
  meta: {
    startedAt: "2025-01-23T10:30:00Z",
    finishedAt: "2025-01-23T10:30:01Z"
  }
}
```

**Example Usage**:

```bash
# Run all checks on current directory (JSON format)
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "check",
    "params": {
      "format": "json"
    }
  }'

# Run only liquid checks
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "check",
    "params": {
      "category": ["liquid"]
    }
  }'

# Exclude performance checks
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "check",
    "params": {
      "excludeCategory": ["performance"]
    }
  }'

# Auto-fix offenses
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "check",
    "params": {
      "autoCorrect": true
    }
  }'

# List all enabled checks
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "check",
    "params": {
      "list": true
    }
  }'

# Print active configuration
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "check",
    "params": {
      "print": true
    }
  }'

# Run checks with custom config
curl -X POST http://localhost:5910/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "check",
    "params": {
      "config": ".platformos-check.yml",
      "failLevel": "error"
    }
  }'
```

**Available Checks** (examples):

| Check Name | Category | Severity | Description |
|-----------|----------|----------|-------------|
| SyntaxError | liquid | error | Detects Liquid syntax errors |
| MissingTemplate | liquid | suggestion | Detects references to missing templates |
| UnusedPartial | liquid | suggestion | Detects unused partial templates |
| UnknownFilter | liquid | error | Detects undefined Liquid filters |
| UndefinedObject | liquid | error | Detects undefined template objects |
| SpaceInsideBraces | liquid | style | Ensures consistent spacing in braces |
| InvalidArgs | liquid, graphql | error | Validates filter/tag arguments |
| FormAction | html | error | Ensures forms have action attribute |
| ImgWidthAndHeight | html, performance | error | Requires width/height on images |
| ParserBlockingJavaScript | html, performance | error | Detects parser-blocking JavaScript |
| ValidYaml | yaml | error | Validates YAML syntax |
| TranslationKeyExists | translation, liquid | error | Validates translation keys exist |

**Use Case**: Lint code, find best practice violations, and auto-fix issues.

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
- `endpoint` *(string, optional)*: Override API base URL

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
    code: "DELETE_REQUIRES_CONFIRMATION",
    message: "File deletion requires confirmDelete=true"
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
  error: { code: "FILE_NOT_FOUND", message: "File not found: /path/to/uploads.zip" }
}

// Upload failed
{
  ok: false,
  error: { code: "UPLOAD_FAILED", message: "Error details..." }
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

### Standard Success Response

Most tools follow this pattern for success:

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

Tools return errors without throwing to prevent server crashes:

```javascript
{
  ok: false,
  error: {
    code: "ERROR_CODE",           // Machine-readable error type
    message: "Human-readable message",
    details?: {...}               // Optional extra details
  }
}
```

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
    \"params\": {\"env\": \"staging\", \"jobId\": \"$IMPORT_ID\", \"isZip\": true}
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
cd mcp-min
MCP_MIN_DEBUG=1 npm start
```

### Testing Tools Locally

```bash
# Start MCP server
cd mcp-min && npm start

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

### Tool Count by Category

- **Asynchronous Operations**: 1 (job-status)
- **Environment Management**: 1 (envs-list)
- **Logging & Monitoring**: 2 (logs-fetch, logs-stream)
- **GraphQL & Liquid**: 2 (graphql-exec, liquid-exec)
- **Generators**: 3 (generators-list, generators-help, generators-run)
- **Migrations**: 3 (migrations-list, migrations-generate, migrations-run)
- **Deployment**: 3 (deploy-start, deploy-status, deploy-wait)
- **Data Operations**: 6 (data-import, data-import-status, data-export, data-export-status, data-clean, data-clean-status)
- **Testing**: 1 (unit-tests-run)
- **Linting**: 1 (check)
- **File Sync**: 1 (sync-file)
- **Property Uploads**: 1 (uploads-push)
- **Constants**: 3 (constants-list, constants-set, constants-unset)

**Total**: 27 active tools

### Tool Locations

All tools are located in the `/home/godot/projects/pos-cli/mcp-min/` directory, organized by category:

- `mcp-min/logs/` - Logging tools
- `mcp-min/liquid/` - Liquid template tools
- `mcp-min/graphql/` - GraphQL tools
- `mcp-min/generators/` - Generator tools
- `mcp-min/migrations/` - Migration tools
- `mcp-min/deploy/` - Deployment tools
- `mcp-min/data/` - Data operation tools
- `mcp-min/tests/` - Testing tools
- `mcp-min/check/` - Linting tools
- `mcp-min/sync/` - File sync tools
- `mcp-min/uploads/` - Property upload tools
- `mcp-min/constants/` - Constants management tools

### Registration

All tools are registered in `mcp-min/tools.js` and exported as a single module for use by both HTTP and stdio MCP servers.

---

## See Also

- [platformOS Documentation](https://documentation.platformos.com)
- [MCP Server Setup](./SSE_GUIDE.md)
- [CLI Reference](./API.md)
