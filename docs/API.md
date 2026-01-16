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

## Error Responses

```json
{ \"error\": \"Unauthorized\" }  // 401
{ \"error\": \"Tool 'foo' not found\" }  // 404
{ \"error\": \"[ZodError]: Invalid input\" }  // 400
```

## MCP Protocol Compliance

- **Tools List**: `/tools` returns JSON schema approximations
- **Tool Calls**: `/call` validates with Zod, returns MCP `content[]` format
- **Streaming**: Not yet implemented (future)

## GraphQL Schema

All tools use Zod schemas internally. Full TypeScript types in `src/types/index.ts`.

---
*See [TOOLS.md](TOOLS.md) for complete tool specifications.*","path":"docs/API.md