# MCP Server API Reference

## Base URL
```
http://localhost:3030
```

## Security

There is **no authentication**: no API key, no Bearer token. Whoever can send the server a request can run every enabled tool with the platformOS credentials it resolves (`.pos`, `MPKIT_*`). The server listens on `127.0.0.1` only, and answers `403` unless the hostname in `Host` (and in `Origin`, when present) is `localhost`, `127.0.0.1` or `[::1]`; that blocks web pages, not local programs. `MCP_MIN_HOST` changes the bind address and `MCP_MIN_ALLOWED_HOSTS` adds accepted hostnames — see the Security section of [SSE_GUIDE.md](SSE_GUIDE.md#security) for both and their risk.

## Endpoints

### `GET /health`
**List server status and available tools**

```bash
curl http://localhost:3030/health
```

**Response**
```json
{
  \"status\": \"ok\",
  \"tools\": [\"platformos.env.list\", \"platformos.graphql.execute\", ...],
  \"toolCount\": 9
}
```

### `GET /tools`
**List available tools with schemas**

```bash
curl http://localhost:3030/tools
```

**Response**
```json
{
  \"tools\": [{
    \"name\": \"platformos.env.list\",
    \"description\": \"List environments...\",
    \"inputSchema\": { \"type\": \"object\", \"properties\": {} }
  }]
}
```

### `POST /call`
**Execute MCP tool**

```bash
curl -X POST http://localhost:3030/call \\
  -H \"Content-Type: application/json\" \\
  -d '{\"tool\":\"platformos.graphql.execute\",\"input\":{\"env\":\"staging\",\"query\":\"query { __schema { types { name } } }\"}}'
```

**Request Body**
```json
{
  \"tool\": \"platformos.graphql.execute\",
  \"input\": { ... }  // Zod-validated per tool
}
```

**Response** (MCP format)
```json
{
  \"content\": [{
    \"type\": \"text\",
    \"text\": \"{\\\"data\\\": {\\\"__schema\\\": {\\\"types\\\": [...]}}}\"
  }]
}
```

### `POST /call-stream` (SSE Streaming) ⚡ **NEW** ⚡
**Execute MCP tool with Server-Sent Events streaming**

```bash
curl -X POST http://localhost:3030/call-stream \\
  -H \"Content-Type: application/json\" \\
  -d '{\"tool\":\"platformos.logs.stream\",\"input\":{\"env\":\"staging\"}}'
```

**Request Body**
```json
{
  \"tool\": \"platformos.logs.stream\",
  \"input\": {
    \"env\": \"staging\",
    \"interval\": 3000,
    \"filter\": \"error\"
  }
}
```

**SSE Response Format**
```
: heartbeat

event: data
data: {\"type\":\"text\",\"text\":\"{\\\"id\\\":\\\"123\\\",\\\"timestamp\\\":\\\"2024-01-01T12:00:00Z\\\",\\\"type\\\":\\\"info\\\",\\\"message\\\":\\\"Log message\\\",\\\"env\\\":\\\"staging\\\"}\"}


event: done
data: [DONE]

```

**Supported Streaming Tools**
- `platformos.logs.stream` - Real-time log streaming with automatic polling
- `platformos.logs.live` - Live log monitoring with duplicate detection and heartbeats

**Streaming Events**
- `data` - Log entry or tool result chunk
- `error` - Error occurred during streaming
- `done` - Stream completed successfully
- Heartbeat events (`:` prefix) - Keep connection alive

**Connection Management**
- Server maintains active connection count
- Automatic cleanup on connection close/error
- Graceful shutdown handling for all active streams

## Error Responses

```json
{ \"jsonrpc\": \"2.0\", \"error\": { \"code\": -32000, \"message\": \"Invalid Host: evil.example\" }, \"id\": null }  // 403
{ \"error\": \"Tool 'foo' not found\" }  // 404
{ \"error\": \"[ZodError]: Invalid input\" }  // 400
```

## MCP Protocol Compliance

- **Tools List**: `/tools` returns JSON schema approximations
- **Tool Calls**: `/call` validates with Zod, returns MCP `content[]` format
- **Streaming**: Now supported via Server-Sent Events on `/call-stream`

## GraphQL Schema

All tools use Zod schemas internally. Full TypeScript types in `src/types/index.ts`.

---
*See [TOOLS.md](TOOLS.md) for complete tool specifications.*