mcp-min: the pos-cli MCP server (stdio + HTTP)

Purpose
- Serves platformOS tools over MCP, on stdio (what editors launch) and over HTTP
- Protocol layer: MCP TypeScript SDK v2 (@modelcontextprotocol/server) — revision 2026-07-28 and the 2025 revisions, from one definition
- HTTP endpoints: POST /mcp (MCP Streamable HTTP) and GET /health; /, /tools, /call and /call-stream are the deprecated pre-SDK API, removed at the next major
- --no-http serves stdio only and does not read MCP_MIN_*

Run
- cd mcp-min
- npm install
- npm start

Debug mode
- To enable verbose debug logging, use: npm run start:debug
- Or set env variable manually: MCP_MIN_DEBUG=1 pos-cli-mcp
- Debug logs include: detailed HTTP access logs, request/response tracing, stdio requests/responses, SSE connection status and heartbeats, and tool-level progress

Root configuration (recommended)
- Server runs at root path (/).
- Endpoints: GET /health, GET /tools, POST /call, POST /call-stream
- SSE handshake on GET / (Accept: text/event-stream) emits first event:
  event: endpoint
  data: /call-stream
- This matches clients (like cagent) that connect to base URL and expect an absolute endpoint path.

Client example (cagent)
- url: http://localhost:5910
- transport_type: sse

Security
- The HTTP transport has no authentication: whoever can send it a request can run every enabled tool with the platformOS credentials the server resolves (.pos, MPKIT_*).
- It listens on 127.0.0.1 only (MCP_MIN_PORT sets the port, default 5910).
- Every request, on every route, must carry a Host whose hostname is localhost, 127.0.0.1 or [::1] (any port), and an Origin with one of those hostnames if it carries an Origin at all. Otherwise it is answered 403 with {"jsonrpc":"2.0","error":{"code":-32000,"message":"Invalid Host: <hostname>"},"id":null} before the body is read. This blocks web pages (DNS rebinding, cross-site requests), not local programs.
- MCP_MIN_HOST: bind address (an IP address or localhost). A non-loopback value such as 0.0.0.0 exposes every enabled tool, unauthenticated, to anyone who can reach the port, and logs a warning on every start. Use it only where that is acceptable, e.g. a container whose port is published to the host's loopback.
- MCP_MIN_ALLOWED_HOSTS: comma-separated hostnames or IP addresses (IPv6 in brackets, no scheme or port) accepted in Host/Origin in addition to the loopback names, for clients that address the server by another name.
- A malformed MCP_MIN_HOST, MCP_MIN_PORT or MCP_MIN_ALLOWED_HOSTS stops the server at startup. A port that is already taken is logged as an error ("HTTP transport not started") and stdio keeps working.

Lifecycle
- Start it as `pos-cli-mcp` (or `pos-cli mcp`); it accepts only --profile, --include-tools, --exclude-tools, --no-http, --help and --version.
- The server exits when its MCP client closes stdin: new work stops, running calls finish (at most 120 s), then the process exits and releases the HTTP port.
- stdin from /dev/null, a file or a terminal with no MCP messages does not end it; use `pos-cli-mcp </dev/null` to run the HTTP transport alone.

Tool selection
- exposed = (tools of --profile ∪ --include-tools) − --exclude-tools − tools disabled in tools.config.json; profiles: full (default), dev, none.
- Resolved once at startup, the same for both transports; a tool that is not exposed is also not callable.
- An unknown profile or tool name, a tool in both lists, including a config-disabled tool, or an empty result stops startup with a message.
- `pos-cli mcp-config` takes the same options and shows what they expose.

Jobs
- Five starters (deploy-start, data-import, data-export, data-clean, tests-run-async) return a job_id; job-status reads any of them back.
- The job_id encodes kind, remote id, instance origin and per-kind flags; it is parsed strictly and never decides credentials or the request URL.
- state: running | completed | failed; completed means the operation finished (failing assertions still count), failed means it did not.
- wait_ms (≤ 120 s) polls with backoff, reports progress, honours ctx.signal, and returns done:false at the deadline.
- A deploy is completed only once its assets are in; the phase comes from this process's own record first, then the release record.
- The six per-operation status tools are deprecated, run on the same adapters, and are removed at the next major.

Files
- index.js: start({ selection, http }); starts stdio and HTTP servers with one shared shutdown (importing it starts nothing)
- protocol/server-factory.js: the McpServer definition both transports serve — tools, published schemas, isError mapping, progress, cancellation
- protocol/http-endpoint.js: /mcp — Express ⇄ web-standard bridge for the SDK's HTTP handler, with the body limit and client-disconnect cancellation
- cancellation.js: ctx.signal helpers for tools that wait or page
- lifecycle.js: when the process ends (stdin EOF rule, drain, deadline)
- cli-args.js: argument parsing for bin/pos-cli-mcp.js, and the tool-selection options shared with bin/pos-cli-mcp-config.js
- tools.js: the tool registry (every tool, in client order); reads no configuration
- profiles.js: built-in profiles (full, dev, none)
- tools-config.js: reads and validates tools.config.json / MCP_TOOLS_CONFIG; the one place its rules live
- tool-selection.js: resolves profile + options + config into the exposed tools; findTool, the lookup every dispatch path uses
- stdio-server.js: MCP over stdio (SDK serveStdio) plus the stdin-EOF session rule
- http-server.js: Express app: /mcp, /health and the deprecated pre-SDK routes
- http-config.js: reads MCP_MIN_HOST / MCP_MIN_PORT / MCP_MIN_ALLOWED_HOSTS
- host-validation.js: Host/Origin check applied to every HTTP route
- jobs/status.js: the job-status tool; jobs/handle.js (the job_id), jobs/auth-for-job.js (which instance), jobs/local-phases.js (uploads this process started), jobs/adapters/* (one per kind)
- deploy/assets-task.js: the background asset upload — waits for the release to settle, then sends the manifest for it
- sync/single-file.js: Extracted implementation of sync.singleFile tool
- sse.js: Server-Sent Events helpers and heartbeat
- config.js: Centralized DEBUG flag and debugLog helper

SSE framing and heartbeat
- Each SSE message is framed using optional "event: <name>" and one or more "data: <line>" lines followed by an empty line
- Heartbeat is sent every 15s as a comment line starting with ':' to keep intermediaries from closing idle connections

Notes
- ESM package. Keep dependencies minimal (express, body-parser, morgan)
- Designed to be a minimal, self-contained example in a single process
