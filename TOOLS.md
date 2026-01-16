# TOOLS.md - Complete Tool Reference

## Available Tools (9+)

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

## Other Tools

- `platformos.logs.fetch` - Fetch recent logs
- `platformos.modules.list` - List modules  
- `platformos.migrations.status` - Migration status
- `platformos.constants.list` - List constants

## Full Tool List

| Tool | Category | Async |
|------|----------|-------|
| `platformos.env.*` (3 tools) | Environment | No |
| `platformos.graphql.execute` | GraphQL | No |
| `platformos.data.export_*` (2) | Data | Yes |
| `platformos.liquid.render` | Liquid | No |
| `platformos.logs.fetch` | Logs | No |
| `platformos.modules.*` | Modules | No |
| `platformos.migrations.*` | Migrations | No |
| `platformos.constants.*` | Constants | No |

---
**See `src/tools/*.tools.ts` for exact Zod schemas & handlers**","path":"TOOLS.md