# TOOLS.md - Complete Tool Reference

## Available Tools (11+)

All tools use **Zod validation** and return **JSON** in MCP `content[0].text`.

## Environment Management

### `platformos.env.list`
**List configured .pos environments**

**Input Schema**
```json
{}
```

**Example**
```bash
curl -X POST http://localhost:3030/call \\
  -H \"Authorization: Bearer client-secret\" \\
  -d '{\"tool\":\"platformos.env.list\",\"input\":{}}'
```

**Output**
```json
{
  \"envs\": [{
    \"name\": \"staging\",
    \"account\": \"example\",
    \"site\": \"staging.example.platformos.net\"
  }]
}
```

### `platformos.env.add`
**Add new environment**

**Input**
```json
{
  \"name\": \"production\",
  \"url\": \"https://prod.example.platformos.net\",
  \"email\": \"admin@company.com\",
  \"account\": \"company\",
  \"token\": \"abc123...\"
}
```

### `platformos.env.auth`
**Verify environment auth**

**Input**
```json
{ \"env\": \"staging\" }
```

## GraphQL

### `platformos.graphql.execute`
**Execute GraphQL query/mutation**

**Input**
```json
{
  \"env\": \"staging\",
  \"query\": \"query { viewer { id email } }\",
  \"variables\": { \"id\": \"123\" }
}
```

**Example**
```bash
curl -X POST http://localhost:3030/call \\
  -H \"Authorization: Bearer client-secret\" \\
  -d '{\"tool\":\"platformos.graphql.execute\",\"input\":{\"env\":\"staging\",\"query\":\"query { __schema { types { name } } }\"}}'
```

## Data Export

### `platformos.data.export_start`
**Start async data export**

**Input**
```json
{
  \"env\": \"staging\",
  \"export_internal\": true,
  \"csv_export\": false
}
```

**Returns** `{ \"jobId\": \"job_123\", \"poll\": true }`

### `platformos.data.export_status`
**Check export status**

**Input**
```json
{
  \"env\": \"staging\",
  \"jobId\": \"job_123\",
  \"csv_export\": false
}
```

## Liquid Rendering

### `platformos.liquid.render`
**Render Liquid template**

**Input**
```json
{
  \"env\": \"staging\",
  \"template\": \"Hello {{ name }}!\",
  \"locals\": { \"name\": \"World\" }
}
```

**Output** `{ \"output\": \"Hello World!\" }`

## Logs ⚡ **Streaming Support**

### `platformos.logs.fetch`
**Fetch recent logs (batch)**

**Input**
```json
{
  \"env\": \"staging\",
  \"lastId\": \"optional-last-log-id\",
  \"limit\": 100
}
```

**Output**
```json
{
  \"logs\": [{
    \"id\": \"log_123\",
    \"message\": \"Error message\",
    \"error_type\": \"error\",
    \"created_at\": \"2024-01-01T12:00:00Z\"
  }],
  \"lastId\": \"log_123\"
}
```

### `platformos.logs.stream` ⚡ **NEW**
**Real-time log streaming with Server-Sent Events**

**Input**
```json
{
  \"env\": \"staging\",
  \"interval\": 3000,
  \"filter\": \"error\"
}
```

**Streaming Output** (SSE events)
```
event: data
data: {\"type\":\"text\",\"text\":\"{\\\"id\\\":\\\"123\\\",\\\"timestamp\\\":\\\"2024-01-01T12:00:00Z\\\",\\\"type\\\":\\\"error\\\",\\\"message\\\":\\\"Error occurred\\\",\\\"env\\\":\\\"staging\\\"}\"}


event: done
data: [DONE]


```

**Use with** `POST /call-stream` endpoint for SSE streaming

### `platformos.logs.live` ⚡ **NEW**
**Enhanced live log monitoring with duplicate detection**

**Input**
```json
{
  \"env\": \"staging\",
  \"interval\": 3000,
  \"filter\": \"error\",
  \"maxDuration\": 300000
}
```

**Features**
- Duplicate detection using log IDs
- Heartbeat events for connection monitoring
- Configurable streaming duration
- Automatic cleanup on completion

**Streaming Output** (SSE events)
```
event: data
data: {\"type\":\"text\",\"text\":\"{\\\"id\\\":\\\"123\\\",\\\"timestamp\\\":\\\"2024-01-01T12:00:00Z\\\",\\\"type\\\":\\\"error\\\",\\\"message\\\":\\\"Error occurred\\\",\\\"env\\\":\\\"staging\\\"}\"}


event: heartbeat
data: {\"type\":\"heartbeat\",\"timestamp\":\"2024-01-01T12:00:00Z\",\"env\":\"staging\"}


event: done
data: [DONE]


```

**Use with** `POST /call-stream` endpoint for SSE streaming

## Other Tools

- `platformos.modules.list` - List modules
- `platformos.migrations.status` - Migration status
- `platformos.constants.list` - List constants

## Full Tool List

| Tool | Category | Async | Streaming |
|------|----------|-------|-----------|
| `platformos.env.*` (3 tools) | Environment | No | No |
| `platformos.graphql.execute` | GraphQL | No | No |
| `platformos.data.export_*` (2) | Data | Yes | No |
| `platformos.liquid.render` | Liquid | No | No |
| `platformos.logs.fetch` | Logs | No | No |
| `platformos.logs.stream` ⚡ | Logs | No | Yes |
| `platformos.logs.live` ⚡ | Logs | No | Yes |
| `platformos.modules.*` | Modules | No | No |
| `platformos.migrations.*` | Migrations | No | No |
| `platformos.constants.*` | Constants | No | No |

---
**See `src/tools/*.tools.ts` for exact Zod schemas & handlers**