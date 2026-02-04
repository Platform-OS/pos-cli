# MCP Server API Reference

## Base URL
```
http://localhost:3030
```

## Authentication

### Admin (Health endpoint)
```
x-api-key: $ADMIN_API_KEY
```

### MCP Clients
```
Authorization: Bearer $CLIENT_SECRET
```
Clients configured in `clients.json`:
```json
{
  \"default\": {
    \"token\": \"client-secret\",
    \"name\": \"Default Client\"
  }
}
```

## Endpoints

### `GET /health` (Admin)
**List server status and available tools**

```bash
curl http://localhost:3030/health -H \"x-api-key: $ADMIN_API_KEY\"
```

**Response**
```json
{
  \"status\": \"ok\",
  \"tools\": [\"platformos.env.list\", \"platformos.graphql.execute\", ...],
  \"toolCount\": 9
}
```

### `GET /tools` (Client)
**List available tools with schemas**

```bash
curl http://localhost:3030/tools -H \"Authorization: Bearer client-secret\"
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

### `POST /call` (Client)
**Execute MCP tool**

```bash
curl -X POST http://localhost:3030/call \\
  -H \"Authorization: Bearer client-secret\" \\
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

### `POST /call-stream` (Client - SSE Streaming) ⚡ **NEW** ⚡
**Execute MCP tool with Server-Sent Events streaming**

```bash
curl -X POST http://localhost:3030/call-stream \\
  -H \"Authorization: Bearer client-secret\" \\
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
{ \"error\": \"Unauthorized\" }  // 401
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