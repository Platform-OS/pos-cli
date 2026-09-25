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

The per-tool examples below give the `name` and `arguments` of a `tools/call`; put them in the envelope above, or send them over stdio. The pre-SDK HTTP API — `GET /`, `GET /tools`, `POST /call`, `POST /call-stream` — was removed in 6.6.0; `/mcp` replaces all of it, and `GET /health` is unchanged.

`--no-http` starts the server without any HTTP listener (stdio only), which is what `pos-cli ai init` writes into client configurations.

### Streaming

A `/mcp` request whose `Accept` includes `text/event-stream` is answered as SSE, and that is where a long call's progress notifications arrive: a tool that reports progress (`job-status` while it waits, `deploy-start`, `logs-fetch`) sends `notifications/progress` for the call's progress token, and a call with a token also gets a heartbeat every five seconds so an idle-timeout does not kill it. An MCP client handles this itself; nothing extra is needed to opt in.

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
| `--profile <name>` | Starting set. `full` (default): every tool. `dev`: `check-run`, `logs-fetch`, `liquid-exec`, `graphql-exec`, `envs-list`, `deploy-dry-run`, `deploy-start`, `job-status`, `unit-tests-run`. `none`: no tools. |
| `--include-tools <names>` | Adds tools to the profile — not an allowlist, unlike Gemini CLI's `includeTools`. For an allowlist: `--profile none --include-tools a,b`. |
| `--exclude-tools <names>` | Removes tools. Excluding a tool the profile does not contain is allowed, so one exclude list works with any profile. |

Names are comma-separated and each option can be repeated. Tools are always listed in the same order, whatever order they are named in. A tool that is not exposed is also not callable: `tools/call` answers it as an unknown tool (`-32601`), exactly like a name that matches no tool.

The server does not start — it prints one message and exits 1 before either transport opens — for an unknown profile, an unknown tool name in either option (close matches are suggested), a tool named in both, `--include-tools` naming a tool that `tools.config.json` disables, or a selection that leaves no tools.

```bash
pos-cli-mcp --profile dev </dev/null &
curl -s http://localhost:5910/tools | jq '.tools[].id'
```

`pos-cli mcp-config` takes the same options and prints what they expose, and why each other tool is not exposed (`not in profile`, `excluded`, `disabled in the tools config`); add `--json` for the same report as JSON. Bare `pos-cli-mcp` exposes `full`; `pos-cli ai init` configures `--profile dev`.

---

## Server Instructions

The server returns an `instructions` string on `initialize` and on `server/discover`, which clients generally place in the model's system prompt. It carries the rules that span tools and that no single tool description can state: how credentials resolve, that every tool answers with `ok` and reports failure as `ok:false` in the body rather than as a failed call, that a relative path resolves against the directory the server was started in, and that a call returning a `job_id` is polled with `job-status` and `wait_ms`.

It is built from the tools the server actually exposes, so a section about a tool is absent when that tool is — `--profile dev` is told about `deploy-start` and `job-status`, not about `data-clean`. It names no tool from another MCP server. `pos-cli mcp-config` prints the exact string a given selection produces.

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

The status of anything `deploy-start`, `data-import`, `data-export` or `data-clean` started. Each of those returns a `job_id` beside its own fields; this reads it back.

The only way to read back anything a starter began. It replaced six per-operation status tools — one each for a deploy, a deploy wait, a data import, export and clean, and an async test run — which it removed in 6.6.0.

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
    instanceStatus: "in_progress", // the instance's own word, which is not `state`
    error: "…",                // only when state is failed
    warnings: ["…"],           // only when there are any — read these on `completed` too
    result: { … }              // kind-specific: the release and asset phase, the export, the test run
  },
  meta: { durationMs, auth: { url, email, token, source } }
}
```

`completed` means the operation finished, even if what it produced reports failures: a test run with failing assertions is `completed`, because the run did its work. `failed` means the operation itself failed.

**Two words, on purpose, and named so they cannot be confused.** `state` is this server's —
`running`, `completed`, `failed`, the same three whatever was started. `instanceStatus` is the
instance's own word for the same moment (`ready_for_import`, `in_progress`, `success`, `error`),
passed through unchanged, and `deploy-start` returns it under the same name when it answers. Branch
on `state`; read `instanceStatus` when you want to know what the instance called it.

**The two disagree, and that is the point.** A deploy whose release has imported while its assets
are still going up is `state: "running"` with `instanceStatus: "success"` — the release succeeded,
the deploy has not finished. Published as `status`, next to `state`, the pair read as one answer
spelled twice: an evaluation branched on the instance's word and reported a deploy as finished
while `result.assets.phase` still said `uploading`. The field was renamed rather than removed,
because it is not a duplicate of anything in `result` — `data-export` does not carry the raw
response there at all, and for the data jobs this is the instance's `status.name` flattened to a
string.

**`result.release` is the release record verbatim**, 815 bytes of it on a measured deploy against
566 for the fields anything here reads. The 249 is a deliberate cost: an allowlist would have to be
maintained, and a field the platform adds — a second kind of `warning`, say — would go silently
missing, which is the failure this tool has already had once. Two of those fields are worth knowing
about rather than reading: `name` is always `"User import"` and has nothing to do with the deploy,
and `module_deployment` tracked `options.partial_deployment` exactly across eight sampled releases,
so it appears to say "this was a partial deploy" and not anything about modules.

**A completed deploy is not always an unqualified one.** The deploy converter discards a file whose
path matches no part of the platformOS layout — anything under `app/tests`, for instance — and the
release still reports `status: "success"`. Every field above would otherwise say the deploy landed,
so the discarded paths are named in `data.warnings`, beside `state` rather than inside the release
record:

```javascript
{
  state: "completed", done: true, instanceStatus: "success",
  warnings: ["2 files matched no part of the platformOS layout, so the deploy did not put them on the instance: tests/eval/simple_test.liquid, tests/probe/c_test.liquid"]
}
```

The list is capped at ten paths for reading; `data.result.release.warning` always carries every one.
`deploy-dry-run` reports the same files as `discarded`, before the deploy rather than after it.

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
```json
{
  "name": "job-status",
  "arguments": { "job_id": "pjob1_…", "wait_ms": 30000 }
}
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

Fetch rows from the instance **error log** — the stream `pos-cli logs` tails. Deployed code writes
to it: a page, a partial or a test run reaches it, including their `{% log %}` output. A render
through `liquid-exec` contributes its **Liquid errors** but not its `{% log %}` output, so a
template debugged that way reports its failures here and leaves no trace of its own logging. HTTP
access logs are not here either; those live in the logsv2 store, which no tool reaches yet.

**A failing `{% background %}` job is visible only here.** Its work happens after the render
returns, so the call that queued it answers `ok: true` with an empty result and no error — the log
is the only place that failure exists, whether the job was queued by a deployed page or by
`liquid-exec`.

**Tool Name**: `logs-fetch`

**Input Parameters**:
- `env` *(string, optional)*: Environment name from `.pos` config
- `url` *(string, optional)*: Instance URL (alternative to `env`)
- `email` *(string, optional)*: Account email
- `token` *(string, optional)*: API token
- `lastId` *(string, optional)*: a `lastId` this tool returned, passed back unchanged. Omit and the start depends on whether you filtered — see **Where a read starts** below
- `since` *(string, optional)*: an ISO-8601 timestamp to read from, instead of `lastId`. Passing both is refused (`SINCE_AND_LAST_ID`)
- `errorType` *(string, optional)*: keep only rows whose `error_type` contains this, ignoring case
- `contains` *(string, optional)*: keep only rows whose `message` contains this, ignoring case
- `limit` *(integer, optional)*: stop after this many **matching** rows, counting from the **oldest** one after the starting cursor (1–10000)

**Response Format**:
```javascript
{
  ok: true,
  data: {
    logs: [
      { id: "1790008519.397928", created_at: "2026-09-21T16:35:19.397Z", error_type: "LowLevelError", message: "..." },
      { id: "1790008926.7639065", created_at: "2026-09-21T16:42:06.763Z", error_type: "LowLevelError", message: "..." }
    ],
    lastId: "1790008926.7639065",
    count: 2,
    scanned: 2,            // only when a filter was used: how many rows were read to find those
    scanLimitReached: true, // only when the scan bound, not the filter or the limit, ended the read
    newestRow: null        // only when a `since` read found nothing: see below
  },
  meta: {
    durationMs: 90000,
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**`newestRow` tells you which kind of empty a `since` read was.** `count: 0` reads the same
whether nothing happened in the window asked about or the instance stopped writing to its log
altogether — an evaluation hit the second and could not tell. When a `since` read comes back with
nothing, one extra read reports the newest row the instance holds: a timestamp far in the past
means the log is stale rather than quiet, and `null` means it holds no rows at all. The field is
absent when rows were found, and absent for a `lastId` read — a tail sits at the tip of the stream
and is empty most times it is called, so the extra request would land on the common case to answer
a question it did not ask. An instance that will not answer it leaves the field off rather than
failing the call.

**Rows carry what the instance said and no more.** `data` is omitted when it is null, and
`updated_at` when it repeats `created_at` — 52 bytes of a measured 322-byte row, which `limit:
10000` would otherwise pay ten thousand times. Both are dropped per row and only when empty, so a
row that does carry `data`, or that was updated after it was written, keeps them.

**On `lastId`**: a row id is a microsecond epoch — `"1790008926.7639065"` — and the instance treats
`last_id` as a strict greater-than. Hand back exactly what the tool returned. Rounding it, or
truncating it to whole seconds, re-delivers every row written in that second; going one second up
skips them. The tool returns it as the string the instance sent, and the schema accepts that string,
so the resume is a straight round trip.

**Filtering happens in this tool, not on the instance.** `/logs` cannot narrow anything: measured
on 2026-09-22, it answers `error_type`, `q`, `search`, `order` and `limit` byte-identically to a
parameter it has never heard of. So `errorType` and `contains` are matched after the rows arrive —
the transfer cost stays between the server and the instance, and only the matches reach the
caller's context, but a narrow search over a large log still reads every row in between and takes
as long as that implies.

`since` is the exception, and it is free: a row id is a microsecond epoch of the same instant
`created_at` names (`1790097411.2168736` ↔ `2026-09-22T17:16:51.216Z`), and `last_id` is a strict
greater-than, so a timestamp converts straight into a cursor and the **instance** skips everything
older. Nothing is fetched to be thrown away.

A call reads at most 10,000 rows, the same ceiling as `limit`'s maximum. A read that stopped there
answers `scanLimitReached: true`, which is how "nothing matched" is told apart from "stopped
looking"; pass the returned `lastId` back to carry on. The cursor advances over every row that was
read, not only the ones returned, so a filtered read resumes after the rows it rejected rather than
in front of them.

**Where a read starts** when you pass neither `lastId` nor `since`:

| call | starts at |
|---|---|
| no `errorType` and no `contains` | the newest rows — you are looking at the log |
| either filter given | the oldest row the instance still keeps — you are searching it |

This is one value to the API and two jobs for the tool, and the difference is the platform's.
Measured 2026-09-25 against an instance holding 35 rows over three days: `last_id=0` is read as
**no cursor at all** and answers with the newest page — 20 rows — while `1`, `0.001` and
`0.000001` are each the strict greater-than documented above and returned all 35. Only the exact
value `0` is special, and **nothing in a response says which of the two you got**.

`logs-fetch` started every uncursored read at `0` while this document and its schema both said it
began at the oldest row kept. A search that did not pass `since` therefore looked at twenty rows
and answered `count: 0`, which is indistinguishable from "that never happened" — an evaluation
searched for an error it had seen two days earlier and believed the empty answer. A filter now
starts at the oldest retained row, because the instance cannot narrow anything and the scan happens
either way; without one the newest rows are what was asked for, and reading the whole retained log
would spend the caller's context on its oldest.

**A row is readable a few seconds after it is written.** Measured 2026-09-25: a crashed test run's
error row appeared 1.4 s, 2.3 s and 2.7 s after the request over three runs, and an evaluation saw
about eight seconds for a page's `{% log %}`. So "did my code log?" asked immediately after
triggering it answers `no` when the answer is `not yet` — read again rather than concluding the
line was never written. `tests/crash-check.js` is the worked example: it retries for five seconds.

An explicit `lastId` or `since` always wins, whichever kind of call it is. To tail, call once and
keep passing the returned `lastId` back. To search from a known time rather than from the oldest
row, pass `since`.

**Example Usage**:
Search the whole retained log for one error — a filter, so it starts at the oldest row kept:

```json
{
  "name": "logs-fetch",
  "arguments": {
    "env": "staging",
    "contains": "divided by 0",
    "limit": 100
  }
}
```

Look at the newest rows — no filter, so it starts at the tail:

```json
{
  "name": "logs-fetch",
  "arguments": {
    "env": "staging",
    "limit": 100
  }
}
```

Fetch next batch starting from previous lastId:

```json
{
  "name": "logs-fetch",
  "arguments": {
    "env": "staging",
    "limit": 100,
    "lastId": "1790008926.7639065"
  }
}
```

Find the GraphQL failures from the last hour, without reading anything else:

```json
{
  "name": "logs-fetch",
  "arguments": {
    "env": "staging",
    "since": "2026-09-22T16:16:51Z",
    "errorType": "liquid",
    "contains": "graphql",
    "limit": 20
  }
}
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
  ok: true,
  data: {
    data: {
      users: [
        { id: "1", name: "Alice", email: "alice@example.com" },
        { id: "2", name: "Bob", email: "bob@example.com" }
      ]
    }
  },
  meta: {
    durationMs: 2000,
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Two kinds of failure, told apart by the response rather than by the message.** GraphQL omits
`data` from a response whose request failed before execution and includes it, `null` included, once
execution has begun, so a document the schema refused is distinguishable from one the instance ran
and refused:

| What happened | `kind` | `code` | `details` |
| --- | --- | --- | --- |
| The document did not parse, or the schema refused it — a syntax error, an unknown field or argument, a variable given an invalid value, several operations with none named | `input` | `GRAPHQL_DOCUMENT_ERROR` | `errors` |
| It ran and the instance refused it, on its own data or permission rules | `instance` | `GRAPHQL_EXEC_ERROR` | `errors`, `data` |

An `input` failure is one the caller can correct and send again; `instance` means read the message
rather than retrying unchanged. Both keep the instance's own message, `locations` and `path`, which
is what names the line and column to fix. A document error carries no `data`, because nothing ran.

**Example Usage**:
Query users:

```json
{
  "name": "graphql-exec",
  "arguments": {
    "env": "staging",
    "query": "{ users { id name email } }"
  }
}
```

Mutation with variables:

```json
{
  "name": "graphql-exec",
  "arguments": {
    "env": "staging",
    "query": "mutation CreateUser($email: String!) { create_user(user: { email: $email }) { id } }",
    "variables": { "email": "newuser@example.com" }
  }
}
```

**Reading the instance back.** The `admin_*` queries return what is actually deployed, source
included — this is how to see what a non-partial deploy would delete, and how to recover a file
that only exists on the instance:

| query | carries |
|---|---|
| `admin_pages` | `slug`, `physical_file_path`, `content`, `format`, `layout`, `deleted_at` |
| `admin_liquid_partials` | `path`, `body` |
| `admin_assets` | `name`, `url`, `content_type`, `file_size` |
| `admin_graphql`, `admin_model_schemas`, `admin_forms`, `admin_authorization_policies`, `admin_liquid_layouts`, `admin_tables` | the rest of the deployed surface |
| `admin_current_instance`, `admin_versions` | what the instance is |

**The identifying field of each of the three is in the tool description** — `admin_pages (slug)`,
`admin_liquid_partials (path)`, `admin_assets (name)` — because that is the guess an evaluation got
wrong, and 21 bytes once a session is cheaper than the failed call plus the introspection call it
cost. Everything else stays out of the description: the schema below is the platform's and changes
without this repository.

**The rest of the field names are not guessable, and they do not have to be.** The instance answers
GraphQL introspection, so `{ __type(name: "LiquidPartial") { fields { name } } }` lists a type's fields.
An agent evaluation lost its first call to `Field 'name' doesn't exist on type 'LiquidPartial'`
(the field is `path`) and recovered only because it thought to try `__type` unprompted — so the
tool description now says so, in 90 bytes, rather than naming more families that were already
reachable.

```json
{
  "name": "graphql-exec",
  "arguments": {
    "env": "staging",
    "query": "{ admin_pages(per_page: 100) { total_entries results { slug physical_file_path } } }"
  }
}
```

It answers what is on the instance, not whether a URL works — `page-fetch` is that.

**On `data.data`.** The outer `data` is this server's result envelope; the inner one is GraphQL's,
and it travels beside `errors` when a document has any. Unwrapping it would either lose `errors` or
make the shape depend on whether the query succeeded, so the two stay, and every path into a result
is `data.data.<field>`.

---

### page-fetch

Fetch a path on an instance over HTTP, as a visitor gets it. This is how to confirm a deploy is
live: reading the source back with `graphql-exec` proves the file arrived, and routing, the layout,
the authorization policies and every partial the page renders all sit between that and the URL.

**Tool Name**: `page-fetch`

**Input Parameters**:
- `env` *(string, optional)*: Environment name
- `url` *(string, optional)*: base URL to fetch from, used instead of `env`. **No `email` or
  `token`** — this is the one tool whose schema does not take them, because it sends none. A closed
  schema means passing either is refused, so an instance you have a URL for and no account on is
  reachable. **Any host, not only the instance's.** `path` is then held to *that* host, which is
  what the origin check enforces; the host itself is the caller's to name, exactly as it is on the
  explicit-credentials path of every other tool. An evaluation used this to fetch a deployed asset
  from the instance's separate asset host and recorded it as undocumented luck, so the description
  says it now. Nothing is sent with the request, so the exposure is the request and not a
  credential — a decision taken on the record 2026-09-25, and one to revisit if the HTTP transport
  ever binds beyond loopback.
- `path` *(string, required)*: path on the instance, starting with `/`

**Response Format**:
```javascript
{
  ok: true,
  data: {
    url: "https://staging.example.com/eval-page",
    status: 200,
    isRedirect: false,
    headers: { "content-type": "text/html; charset=utf-8" },
    contentBytes: 80,
    body: "<h1>pos-cli MCP eval</h1>…",
    truncated: false
  },
  meta: { … }
}
```

**The host is the resolved credentials' host and nothing else.** `path` is a path, checked twice:
the schema requires a single leading `/`, and the URL built from it must still have the instance's
origin. The second check is the one that holds the rule — `//elsewhere.example.com` reads as a path
and is another host to `new URL` — and a path that resolves away answers `PATH_NOT_ON_INSTANCE`
before any request is made. No argument here may move a request; this takes the strictest reading
of that.

**No credentials are sent.** A page that only renders for a holder of the instance API token is not
a page that is live, and a redirect — reported, never followed — therefore cannot carry a credential
anywhere. A `3xx` comes back with `isRedirect: true` and `headers.location`. The field is
`isRedirect` rather than `redirected` because on a Fetch `Response` that name means the opposite —
that the redirect *was* followed.

A `404` is `ok: true` with `status: 404`: the agent asked whether the page is live, and the answer
is that it is not. `ok: false` is reserved for a call that could not be made — an unreachable
instance, a path off the instance.

The body is capped at 16 KB, cut on a character boundary, with `contentBytes` giving the real size
and `truncated` saying it was cut. A response that is not text is described in `bodyOmitted` rather
than returned: an image or an archive is megabytes of noise to a model, and says nothing its status
and size do not. Where such a response declares a `content-length`, that is the whole answer, so the
body is released unread rather than pulled into the server to be counted and thrown away.

It is **not** `readOnlyHint`. A GET on a platformOS page runs that page's Liquid, and this tool
cannot know what that does; MCP reads a missing hint as "may change things", which is the honest
answer.

**Use Case**: Confirm a deploy is live; check what a visitor actually gets from a URL.

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
- `locals` *(object, optional)*: values the template reads as top-level Liquid variables

**Response Format**:
```javascript
{
  ok: true,
  data: {
    result: "Hello Alice! Your score is 42."
  },
  meta: {
    durationMs: 1000,
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**On `locals`**: the endpoint renders in a context where nothing the caller sends is a variable —
the whole request body arrives at `context.params` and nowhere else. So the tool binds each local
for you, by prefixing the template with one `{% assign <name> = context.params.locals.<name> %}`
per key. Both spellings therefore work, `{{ name }}` and `{{ context.params.locals.name }}`, and
only the path is written into the template, never the value: objects, arrays and booleans arrive as
themselves rather than as their JSON. The prefix adds no line, so a `Liquid error (line N)` still
names the line you wrote.

A key that is not a Liquid name (`[A-Za-z_][A-Za-z0-9_]*`), or that would shadow `context`, cannot
be bound. It is left where the instance put it — reachable as `context.params.locals["content-type"]`
— and named back in `data.unboundLocals`, which is absent when there are none. The template's own
`{% assign %}` of the same name still wins, since it runs after the prefix.

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

A render can also fail *after* building most of a page, in which case the endpoint's own `error` is
null and `Liquid error (line N): …` is rendered into the output instead. The `message` is then the
error lines lifted out of that output — distinct lines only, at most ten — rather than the page
they were found in. `details` carries the endpoint's response, including the output it managed to
render, with each of its top-level strings capped at 4,096 characters.

**Example Usage**:
Simple template:

```json
{
  "name": "liquid-exec",
  "arguments": {
    "env": "staging",
    "template": "Hello {{ name }}!",
    "locals": { "name": "Alice" }
  }
}
```

Template with logic:

```json
{
  "name": "liquid-exec",
  "arguments": {
    "env": "staging",
    "template": "{% if score >= 50 %}Passed{% else %}Failed{% endif %}",
    "locals": { "score": 75 }
  }
}
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
```json
{"name": "generators-list", "arguments": {}}
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
```json
{
  "name": "generators-help",
  "arguments": { "generatorPath": "modules/core/generators/model" }
}
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
Generate a model:

```json
{
  "name": "generators-run",
  "arguments": {
    "generatorPath": "modules/core/generators/model",
    "args": ["user"],
    "options": { "fields": "name,email,phone" }
  }
}
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
```json
{
  "name": "migrations-list",
  "arguments": { "env": "staging" }
}
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
```json
{
  "name": "migrations-generate",
  "arguments": {
    "env": "staging",
    "name": "add_user_fields"
  }
}
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
By name:

```json
{
  "name": "migrations-run",
  "arguments": {
    "env": "staging",
    "name": "1674403200_add_user_fields"
  }
}
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
the archive is written under `tmp/` (in a directory of its own per call, described below).

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
    appPath: "/home/you/projects/my-app",
    discarded: { count: 1, files: ["tests/eval/simple_test.liquid"] },
    warnings: ["Module(s) 'tests' are not configured for automatic file deletion during deploy."],
    planComputed: true,
    deleted:  { count: 2, files: ["views/pages/old.liquid", "graphql/gone.graphql"] },
    upserted: { count: 12, files: ["views/pages/index.liquid", "..."] },
    skipped:  { count: 1, files: ["graphql/unchanged.graphql"] },
    byCategory: {
      Liquid: { upserted: {...}, deleted: {...}, skipped: {...} },
      Asset:  { upserted: {...}, deleted: {...}, skipped: {...} }
    },
    assets: { state: "validated", count: 42 },
    verdict: "would_succeed",
    archive: { fileCount: 156 }
  },
  meta: { ... }
}
```

**`dataLoss` names the deletions that cost records.** A deploy that is not partial deletes every
file missing from the build, and in the flat `deleted` list a table schema reads exactly like a
partial — but dropping `app/schema/*.yml` drops the rows in that table, which are not in the
archive and which no second deploy puts back. The field appears only when such a deletion is in
the list, and names a subset of `deleted` rather than removing anything from it. It is keyed on the
converter's own category (`Tables`, measured 2026-09-23); a category pos-cli does not recognise is
never flagged, so silence here means "not known to destroy data", not "safe".

**Assets are not deleted by a non-partial deploy.** Measured 2026-09-23: an asset on the instance
and absent from the project does not appear in `deleted` at all, and no `Asset` category appears in
`byCategory` for deletions. Installed modules are likewise outside what the release replaces.

**A preview leaves a release behind.** `dry_run=true` is not a request the API answers without
recording: it allocates a release id, validates the archive against it, and keeps the record —
`status: success`, `deleted_at: null`, one id per preview, measured 2026-09-23. Previews therefore
outnumber deploys in an instance's release history, since a dry run is the recommended step before
every deploy.

That is intended rather than accidental, and the evidence is in the record: a preview is stamped
`options.dry_run: "true"`, where a real deploy's is `null`. Anything reading the history can tell
the two apart on that field — `status` alone cannot, because both say `success`. pos-cli does not
try to delete or hide these records; they are the platform's, and the marker is what makes them
readable.

**`appPath` is the project these paths came from.** Both deploy tools resolve `app/`,
`marketplace_builder/` and `modules/` against the server's own working directory, and no argument
can name a different one — an MCP server is started by an editor, so its directory is whatever
launched it. A delete list is only meaningful once you know which project it is for, so both tools
report the directory they archived, the same way `check-run` reports the one it linted. If it is
not the project you meant, the fix is to start the server there; nothing in the call can move it.

`deleted`, `upserted` and `skipped` are totals across every category, so an agent can branch on
`data.deleted.count` without walking the report — **once `planComputed` is true**. Each carries
`count` and `files` separately because the API answers some categories with a count rather than the
paths; `count` is right either way, and `files` is empty when it was not given them.

**`planComputed` says whether those lists are an answer at all.** The instance works out what a
deploy would change only if it accepts the release; one it refuses carries `report: null`, measured
2026-09-25 — and every total was then computed from that nothing. A full deploy that would have
removed four pages, some forty partials and a table holding a record was reported as
`deleted: {count: 0, files: []}`, which is the opposite of the truth on the one field read before a
destructive deploy. When `planComputed` is false, `deleted`, `upserted`, `skipped` and `byCategory`
are **absent rather than empty**, so nothing can be mistaken for a computed zero; `planComputed`
itself is always present. It is keyed on the report rather than on `verdict`, so a refusal that does
report what it would have changed still publishes those lists.

Nothing here can compute a plan the instance declined to make. Where the refusal is a table that
still holds records, seeing the rest of the plan means deleting those records first — which a
preview must not do, and which `error.message` describes in the instance's own words.

`warnings` is what the instance said about the deploy besides refusing or allowing it, taken from
the release record — a module not configured for automatic file deletion, for one, which means a
delete list is shorter than it looks. `job-status` reports the same warnings after a deploy; here
they arrive while they can still be acted on. The discarded files are not repeated in it, because
`discarded` already names them. The field is absent when the release carried none.

`discarded` is the files the deploy would drop: paths matching no part of the platformOS layout,
which the converter throws away while the release still reports success. It is always present, so
`discarded.count === 0` means nothing would be dropped rather than "this tool does not answer that",
and it does not change `verdict` — the deploy really would succeed, minus those files. `job-status`
reports the same list in `warnings` once the deploy has run.

`verdict` is `would_succeed`, `would_fail` or `not_known`. The instance evaluates the dry run and
can refuse the deploy outright — a table that still holds records cannot be dropped, for one — and
`would_fail` means `deploy-start` would be refused in the same way; `error.files` names what it
objected to. `not_known` means the release had not settled within the timeout. In both cases there
is no file report yet, so `planComputed` is false and the change lists are absent. The file report
is read from the release once it settles, not from the upload response, which carries none.

Each call writes its archive into a directory of its own under `tmp/pos-cli-mcp-deploy/` and
removes it when the call is done, so two deploys started close together cannot pack over each
other. `archive` therefore reports the file count and not a path: there is nothing left to open.

`assets.state` is one of `none` (the project has no assets), `validated` (the manifest was checked,
and its verdict is the `Asset` category), `failed` (the asset phase rejected it, with `error`),
`not_reported` (nothing was checked — an API that does not report on assets, a release the instance
gave no id for, or one it refused, which leaves nothing for a manifest to be validated against) or
`still_validating` (the 60-second wait ended first — the file report above it is complete
regardless). `count` is the number of asset files found locally, so `none` and `not_reported` are
never confused: `none` is a claim about the project and always carries `count: 0`, while
`not_reported` carries the project's own count whether or not anything validated it. The manifest is sent so the API can
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

`assets.status` is `deploying_in_background` (the assets are going straight to object storage, and
`job-status` reports when they land), `in_release_archive` or `skipped`.

**`in_release_archive`** is the fallback `pos-cli deploy` has always had. An instance with no object
storage configured cannot presign an upload, and answers `501`. Asked before the archive is built,
because the answer decides what goes into it: the assets travel inside the release instead, there is
no second phase to wait for, and `job-status` reports the deploy finished when the release is in.
`assets.reason` says why, and `archive.assetsIncluded` is `true`.

**Response Format**:
```javascript
{
  ok: true,
  data: {
    id: "abc123def456",
    appPath: "/home/you/projects/my-app",
    job_id: "...",
    instanceStatus: "processing",
    archive: { fileCount: 156, assetsIncluded: false },
    assets: { count: 42, status: "deploying_in_background" },
    params: { partial: false }
  },
  meta: {
    durationMs: 5000,
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" },
    params: { partial: false }
  }
}
```

**Example Usage**:
Full deploy:

```json
{
  "name": "deploy-start",
  "arguments": { "env": "staging", "partial": false }
}
```

Partial deploy (doesn't remove files):

```json
{
  "name": "deploy-start",
  "arguments": { "env": "staging", "partial": true }
}
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
    instanceStatus: "processing",
    isZip: false
  },
  meta: {
    durationMs: 2000,
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Example Usage**:
Import from file:

```json
{
  "name": "data-import",
  "arguments": {
    "env": "staging",
    "filePath": "./export.json"
  }
}
```

Import from JSON object:

```json
{
  "name": "data-import",
  "arguments": {
    "env": "staging",
    "jsonData": {
      "users": [
        { "external_id": "1", "name": "Alice", "email": "alice@example.com" },
        { "external_id": "2", "name": "Bob", "email": "bob@example.com" }
      ]
    }
  }
}
```

Import from remote ZIP:

```json
{
  "name": "data-import",
  "arguments": {
    "env": "staging",
    "zipFileUrl": "https://example.com/backup.zip"
  }
}
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
    instanceStatus: "processing",
    isZip: false
  },
  meta: {
    durationMs: 2000,
    auth: { url: "https://...", email: "...", token: "abc...xyz", source: ".pos(staging)" }
  }
}
```

**Example Usage**:
Export as JSON:

```json
{
  "name": "data-export",
  "arguments": {
    "env": "staging",
    "zip": false
  }
}
```

Export as ZIP with internal IDs:

```json
{
  "name": "data-export",
  "arguments": {
    "env": "staging",
    "zip": true,
    "exportInternalIds": true
  }
}
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
    instanceStatus: "processing",
    includeSchema: false
  },
  warning: "This operation is irreversible. All data has been removed from the instance.",
  meta: {
    durationMs: 2000,
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
Clean data only:

```json
{
  "name": "data-clean",
  "arguments": {
    "env": "staging",
    "confirmation": "CLEAN DATA",
    "includeSchema": false
  }
}
```

Clean data AND schema:

```json
{
  "name": "data-clean",
  "arguments": {
    "env": "staging",
    "confirmation": "CLEAN DATA",
    "includeSchema": true
  }
}
```

**Use Case**: Reset instance for testing or troubleshooting.

---

## Testing

### unit-tests-run

Run platformOS tests on an instance and wait for the verdict.

**Tool Name**: `unit-tests-run`

**Input Parameters**:
- `env` *(string, optional)*: Environment name from `.pos` config
- `url` / `email` / `token` *(string, optional)*: Explicit credentials
- `name` *(string, optional)*: Any part of a test path, matched as a substring. **Omit it to run
  every test.** Test files live under `app/lib` and their path must end with `_test`; a deploy
  silently discards anything under `app/tests`. A test takes and returns a `contract` and calls
  assertions under `modules/tests/assertions/`, each of which documents its own parameters in a
  `{% doc %}` block.

**How a test is written is on `name`, and it is the one thing this server used to leave to source.**
An evaluation read three files of the tests module — `assertions/equal.liquid`,
`helpers/register_error.liquid` and `commands/run.liquid` — to learn the `contract` convention,
which was the only moment in the run it needed source it could not get from a tool. The pointer
existed on the `NO_TESTS` error, but that fires only on an instance with **no test files at all**,
so an agent writing a new test where tests already exist could never reach it. The assertions are
named rather than their signatures copied here: the contract belongs to the tests module, and a
copy of it in this repository would be wrong the first time that module changed.

`path` was removed in 6.6.0. The tests module filters on `name` alone and never read it, so a run
narrowed with `path` quietly ran the whole suite — measured against tests@1.3.5.

**Response Format**:
```javascript
{
  ok: true,
  data: {
    passed: false,          // no failed assertions; never true for a run that matched nothing
    matched: 38,            // test files that ran
    assertions: 110,
    failures: 7,
    durationMs: 71,
    tests: [
      { name: "gen/gen03_test", success: false, assertions: 3,
        errors: { gen03_middle: ["expected 4 to equal 5"] } },
      { name: "gen/gen04_test", success: true, assertions: 3 }
    ],
    url: "https://staging.example.com/_tests/run.js?name=gen"
  },
  meta: { … }
}
```

`errors` is present only on a test that has some. A passing test keeps its `name` and `assertions`,
which is what says it ran. An assertion message is capped at 2,000 characters with a marker saying
how much was left out: `should.equal` renders both compared values into it, so one test comparing
two large objects produced a 103 KB result before the cap and 4.8 KB after, on the same suite.

**A failing assertion is a completed run, not a failed call.** The runner answers **HTTP 500** when
any assertion fails — deliberate, and how it signals a red build to CI — so the body is read before
the status is judged. Reading the status first reported a red build as `kind: unavailable`, which
the server instructions define as "the same call may work later"; an agent following them retries
forever. `ok: false` is reserved for a call that could not be made.

**A selection that matched nothing is refused, not passed.** No tests means no failures, which used
to answer `passed: true` for a mistyped name or a suite that was never deployed. A `name` that
matches nothing is now `NO_TESTS_MATCHED` (`not_found`); no `name` and no tests at all is `NO_TESTS`
(`project`). Both name the GraphQL query that lists the test files, since no tool does.

**A test that raises takes the run down, and the reason is in the instance's log.** The runner
answers 500 with an HTML error page naming nothing — not the test, not the file, not the cause —
so `TEST_RUN_CRASHED` used to say only that something had raised and suggest narrowing with `name`,
which cannot help when `name` already matched one test. It is `kind: project`: the next step is to
fix code in the project.

The instance does record it. After the health probe that separates "a test raised" from "the
instance is down", `unit-tests-run` reads the error log for the failure this run produced and
reports it:

```javascript
{
  kind: "project", code: "TEST_RUN_CRASHED",
  message: "A test matching 'eval4_error' raised while it was running, so the run stopped and the
            runner answered 500 with an error page. … The instance logged it at
            lib/test/eval4_error_test.liquid:3: Liquid::ZeroDivisionError — 10 divided by 0",
  details: {
    statusCode: 500,
    error: { type: "Liquid::ZeroDivisionError", message: "10 divided by 0" },
    stack: [ { path: "lib/test/eval4_error_test.liquid", line: 3 }, … ]   // innermost first, capped at 5
  }
}
```

Two fields find that row and both are the platform's, not the tests module's: `data.type` is the
exception class, written only by the instance's own error handler — measured 2026-09-25, an error
row carries `type` and `message` inside `data` while a `{% log %}` row carries neither — and
`data.context.url` is the request that produced the row, which ties it to this run rather than to
another in flight. A row is not readable the instant it is written: measured over three crashed runs
it appeared 1.4 s, 2.3 s and 2.7 s after the request, so the read is retried for up to five seconds.

All of it is best effort. A log the instance will not serve, a row that never arrives, or a client
that cancels leaves the classification exactly as it was, with the message pointing at `logs-fetch`
and `since` instead. The whole cost lands on a run that has already failed.

**Older tests modules**: the per-test `tests` array is empty on a module whose JSON report had not
yet been fixed, while `matched`, `assertions` and `failures` are still correct — so the counts and
the detail are read separately. A module older than tests 1.1.0 serves no `/_tests/run.js` at all
and answers `TESTS_MODULE_OUTDATED` with the command that updates it.

**Example Usage**:

Run every test:

```json
{
  "name": "unit-tests-run",
  "arguments": { "env": "staging" }
}
```

Run one test, or a directory of them:

```json
{
  "name": "unit-tests-run",
  "arguments": {
    "env": "staging",
    "name": "create_user_test"
  }
}
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
- `appPath` *(string, optional)*: the **project root** to lint — the directory holding `.pos`, `.platformos-check.yml`, `app/` or `modules/`, not a subdirectory of it (default: current directory)
- `autoFix` *(boolean, optional, default: false)*: Fix what can be fixed, then re-check and return what remains. See the note below: no check currently ships a correction, so this writes nothing today.

**Response**:
```json
{
  "ok": true,
  "data": {
    "offenseCount": 3,
    "filesWithOffenses": 2,
    "errorCount": 1,
    "warningCount": 2,
    "infoCount": 0,
    "filesChecked": 128,
    "autoFixed": false,
    "fixable": 0,
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
  "meta": { "durationMs": 1843, "appPath": "/abs/path" }
}
```

**Errors**: `PATH_NOT_FOUND` and `NOT_A_DIRECTORY` for an `appPath` that is not a directory on this
machine; `NOT_A_PROJECT_ROOT` (`kind: input`) for one that is a directory but not the root of a
platformOS project; `MISSING_DEPENDENCY` if the linter cannot be loaded from the installation.

**`appPath` is a project root, and `app/` is not one.** The linter resolves the root by looking for
`.pos`, `.platformos-check.yml`, `app/`, `marketplace_builder/` or `modules/` at or above the path
it is given, and refuses anything that is not that root — its message names the path you passed
and, where it can say so, the root to use instead. That refusal is forwarded whole as
`NOT_A_PROJECT_ROOT`. It used to arrive as `kind: internal`, which the server instructions define
as "a defect in pos-cli", so an evaluation that passed `appPath: "app"` was told to report a bug
about its own argument. It is `input`: the fix is to name a different directory.

**Example Usage**:
Lint the current directory:

```json
{
  "name": "check-run",
  "arguments": {}
}
```

Lint another project and fix what can be fixed — note the path is the project root, not its `app/`:

```json
{
  "name": "check-run",
  "arguments": {
    "appPath": "../other-project",
    "autoFix": true
  }
}
```

**What `autoFix` did, and what it could have done.** `autoFixed: false` on its own could mean
"nothing here is auto-fixable" or "the pass did not run", and an agent had to diff its own working
tree to tell them apart — on the one tool here that writes to disk. `fixable` is how many of the
reported offenses could be corrected automatically, and it is computed **whether or not `autoFix`
was asked for**, so a plain lint tells you what a fixing run would be worth. `fixedFiles` names the
files that were written, and is absent when none were.

**Today that number is always 0.** Not one of platformos-check's 54 checks builds a correction, so
`autoFix` cannot write anything whatever it is pointed at. The plumbing is kept because the fix is
upstream's to ship, and a test fails if it ever does — at which point this note should go.

**Use Case**: Find violations before deploying. When `autoFix` becomes real it writes to the files
it fixes, so the positions in a previous result no longer apply afterwards.

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
    durationMs: 0,
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
Upload a file:

```json
{
  "name": "sync-file",
  "arguments": {
    "env": "staging",
    "filePath": "app/views/index.html",
    "op": "upload"
  }
}
```

Delete a file (requires confirmation):

```json
{
  "name": "sync-file",
  "arguments": {
    "env": "staging",
    "filePath": "app/views/old.html",
    "op": "delete",
    "confirmDelete": true
  }
}
```

Dry run upload (simulate without performing):

```json
{
  "name": "sync-file",
  "arguments": {
    "env": "staging",
    "filePath": "app/views/index.html",
    "op": "upload",
    "dryRun": true
  }
}
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
    durationMs: 5000
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
Upload a ZIP file:

```json
{
  "name": "uploads-push",
  "arguments": {
    "env": "staging",
    "filePath": "./uploads.zip"
  }
}
```

Upload from seed directory:

```json
{
  "name": "uploads-push",
  "arguments": {
    "env": "production",
    "filePath": "./seed/images.zip"
  }
}
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

Using MCP server:

```json
{
  "name": "uploads-push",
  "arguments": {
    "env": "staging",
    "filePath": "./uploads.zip"
  }
}
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
```json
{
  "name": "data-import",
  "arguments": {
    "env": "staging",
    "filePath": "./seed/data.json"
  }
}
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

mcp() {
  curl -s -X POST http://localhost:5910/mcp \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -H 'MCP-Protocol-Version: 2025-06-18' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}" \
    | sed -n 's/^data: //p' | jq -r '.result.content[0].text'
}

echo "=== Step 1: Push uploads ==="
mcp uploads-push "{\"env\": \"$ENV\", \"filePath\": \"./uploads.zip\"}" | jq .

echo ""
echo "=== Step 2: Import data ==="
IMPORT=$(mcp data-import "{\"env\": \"$ENV\", \"filePath\": \"./seed/data.json\"}")
echo "$IMPORT" | jq .
JOB_ID=$(echo "$IMPORT" | jq -r '.data.job_id')

echo ""
echo "=== Step 3: Wait for import ==="
# job-status waits for up to wait_ms rather than being polled in a loop; a job longer than the
# 120 s bound is a few of these calls, each returning the state it had reached.
mcp job-status "{\"job_id\": \"$JOB_ID\", \"wait_ms\": 120000}" | jq .

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
    durationMs: 1000
  }
}
```

**Example Usage**:
```json
{
  "name": "constants-list",
  "arguments": { "env": "staging" }
}
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
    durationMs: 1000
  }
}
```

**Example Usage**:
Set a new constant:

```json
{
  "name": "constants-set",
  "arguments": {
    "env": "staging",
    "name": "API_KEY",
    "value": "sk-1234567890"
  }
}
```

Update an existing constant:

```json
{
  "name": "constants-set",
  "arguments": {
    "env": "production",
    "name": "STRIPE_KEY",
    "value": "pk_live_xxxxx"
  }
}
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
    durationMs: 1000
  }
}
```

**Example Usage**:
```json
{
  "name": "constants-unset",
  "arguments": {
    "env": "staging",
    "name": "DEPRECATED_KEY"
  }
}
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
    durationMs: 2000,
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
  meta: { durationMs: 1843 }
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

`code` is more specific than the kind wherever pos-cli knows something the status does not say:

| code | what it adds |
|---|---|
| `PAYLOAD_TOO_LARGE` | a 413: the request body is over the 50MB limit |
| `PARTNER_PORTAL_UNAVAILABLE` | a 503 the instance explains — it could not reach the Partner Portal, which is the only thing that can verify an API token, so the token was never judged and refreshing it cannot help. `details.retryAfterSeconds` says how long to wait |
| `ENOTFOUND` / `EAI_AGAIN` | the instance hostname does not resolve; `details.host` names it |
| `ECONNREFUSED` / `ETIMEDOUT` / `ECONNRESET` | the host is there and did not answer; `details.host` names it |
| `ENV_NOT_FOUND` | the `env` is not in `.pos`; `details.environments` lists the ones that are |

A 500, 502 or 504 says in its message that platformOS has already been notified, so it is not
something to report or to work around.

**`details.remedy`** appears where a failure has a command that fixes it: `{ command, runBy }`.
`runBy` is part of the advice, not a label — a remedy that says a person runs it needs a password,
a second factor or a browser, and an agent that runs it itself stops on a prompt nobody can answer.
Today three failures carry one: a rejected `.pos` token (`pos-cli env refresh-token`), an `env` that
is not in `.pos` when none are configured (`pos-cli env add`), and a missing tests module
(`TESTS_MODULE_MISSING`).

**A failure of the work is not a failure of the call.** A test run whose assertions failed answers
`ok: true` — the run did what was asked, and the failures are in `data`. So does a `job-status` call
about a job that failed, and a `data-validate` run that found invalid records. `ok: false` means the
tool did not do what was asked.

### Async Job Pattern

Every long-running operation follows the same pattern, whatever it started.

**1. Start it**:
```json
{ "name": "deploy-start", "arguments": { "env": "staging" } }
```

**2. Take the `job_id` from the response**:
```javascript
{
  "ok": true,
  "data": {"id": "abc123def456", "job_id": "pjob1_…", "instanceStatus": "ready_for_import"}
}
```

**3. Poll it**:
```json
{ "name": "job-status", "arguments": { "job_id": "pjob1_…" } }
```

**4. Or wait for it**:
```json
{ "name": "job-status", "arguments": { "job_id": "pjob1_…", "wait_ms": 60000 } }
```

Poll until `done` is true. `wait_ms` is bounded (120 s maximum); reaching the deadline returns the current state with `done: false`, so a long job is a few waits rather than one call that never ends.

---

## Workflow Examples

Every example below uses this helper:

```bash
# One helper for every call below. /mcp answers a 2025-era request as a single SSE message whose
# result carries the tool's JSON as text, so the reply is unwrapped once here rather than inline.
mcp() {
  curl -s -X POST http://localhost:5910/mcp \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -H 'MCP-Protocol-Version: 2025-06-18' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}" \
    | sed -n 's/^data: //p' | jq -r '.result.content[0].text'
}
```

### Complete Deployment Workflow

```bash
JOB_ID=$(mcp deploy-start '{"env": "staging"}' | jq -r '.data.job_id')

# Waits for the release and its assets both to be in.
mcp job-status "{\"job_id\": \"$JOB_ID\", \"wait_ms\": 120000}" | jq .
```

### Data Migration Workflow

```bash
# 1. Export from production, and wait for the export to be written
EXPORT_JOB=$(mcp data-export '{"env": "production", "zip": true}' | jq -r '.data.job_id')
ZIP_URL=$(mcp job-status "{\"job_id\": \"$EXPORT_JOB\", \"wait_ms\": 120000}" | jq -r '.data.result.zipFileUrl')

# 2. Import it into staging, and wait for that
IMPORT_JOB=$(mcp data-import "{\"env\": \"staging\", \"zipFileUrl\": \"$ZIP_URL\"}" | jq -r '.data.job_id')
mcp job-status "{\"job_id\": \"$IMPORT_JOB\", \"wait_ms\": 120000}" | jq .
```

### Test & Deploy Workflow

```bash
# 1. Run the tests, and deploy only if none failed
if [ "$(mcp unit-tests-run '{"env": "staging"}' | jq -r '.data.passed')" = "true" ]; then
  mcp deploy-start '{"env": "staging"}' | jq .
fi
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
curl -s -X POST http://localhost:5910/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"envs-list","arguments":{}}}'
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
| Testing | `unit-tests-run` (dev) |
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
