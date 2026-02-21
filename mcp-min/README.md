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
- headers: { Authorization: "Bearer <secret>" }

Files
- index.js: entry point; starts stdio and HTTP servers
- stdio-server.js: simple JSON-line protocol over stdin/stdout
- http-server.js: Express-based HTTP API and SSE streaming endpoint
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
