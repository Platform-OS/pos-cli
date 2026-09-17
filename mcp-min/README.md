mcp-min: Minimal MCP server (stdio + HTTP with SSE)

Purpose
- Demonstration subpackage that runs both a JSON-line stdio transport and an HTTP server
- HTTP endpoints: /health, /tools, /call, /call-stream (POST)
- Includes tools: echo, list-envs (reads .pos and returns environments)

Run
- cd mcp-min
- npm install
- npm start

Debug mode
- To enable verbose debug logging, use: npm run start:debug
- Or set env variable manually: MCP_MIN_DEBUG=1 node index.js
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
- Start it as `pos-cli-mcp` (or `pos-cli mcp`); it accepts only --help and --version.
- The server exits when its MCP client closes stdin: new work stops, running calls finish (at most 120 s), then the process exits and releases the HTTP port.
- stdin from /dev/null, a file or a terminal with no MCP messages does not end it; use `pos-cli-mcp </dev/null` to run the HTTP transport alone.

Files
- index.js: entry point; starts stdio and HTTP servers with one shared shutdown
- lifecycle.js: when the process ends (stdin EOF rule, drain, deadline)
- cli-args.js: argument parsing for bin/pos-cli-mcp.js
- stdio-server.js: simple JSON-line protocol over stdin/stdout
- http-server.js: Express-based HTTP API and SSE streaming endpoint
- http-config.js: reads MCP_MIN_HOST / MCP_MIN_PORT / MCP_MIN_ALLOWED_HOSTS
- host-validation.js: Host/Origin check applied to every HTTP route
- tools.js: Tool registry with handlers (echo, list-envs, sync.singleFile)
- sync/single-file.js: Extracted implementation of sync.singleFile tool
- sse.js: Server-Sent Events helpers and heartbeat
- config.js: Centralized DEBUG flag and debugLog helper

SSE framing and heartbeat
- Each SSE message is framed using optional "event: <name>" and one or more "data: <line>" lines followed by an empty line
- Heartbeat is sent every 15s as a comment line starting with ':' to keep intermediaries from closing idle connections

Notes
- ESM package. Keep dependencies minimal (express, body-parser, morgan)
- Designed to be a minimal, self-contained example in a single process
