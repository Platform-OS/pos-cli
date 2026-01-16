# platformOS MCP Server

## Overview

MCP Server providing platformOS API access via HTTP endpoints compatible with MCP clients.
Supports GraphQL execution, environment management, and more via pos-cli integration.

## Quick Start

1. **Prerequisites**
   ```bash
   npm install
   ```

2. **Seed .pos environments** (create `.pos/envs/staging.json`):
   ```json
   {
     "url": "https://staging.example.platformos.net",
     "account": "your-account",
     "email": "your@email.com",
     "token": "your-access-token"
   }
   ```

3. **Set environment variables**
   ```bash
   export ADMIN_API_KEY=your-admin-secret
   ```

4. **Start server**
   ```bash
   npm run dev
   ```

## API Usage

### Health Check (Admin)
```bash
curl http://localhost:3030/health -H "x-api-key: $ADMIN_API_KEY"
```

### List Tools (Client)
```bash
curl http://localhost:3030/tools -H "Authorization: Bearer client-secret"
```

### Execute GraphQL (Client)
```bash
curl -X POST http://localhost:3030/call \\
  -H "Authorization: Bearer client-secret" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "platformos.graphql.execute",
    "input": {
      "env": "staging",
      "query": "query { __schema { types { name } } }"
    }
  }'
```

Expected response:
```json
{
  "content": [{
    "type": "text",
    "text": "{\"success\":false,\"error\":\"GraphQL not directly available via CLI; use server proxy\"}"
  }]
}
```

### List Environments
```bash
curl -X POST http://localhost:3030/call \\
  -H "Authorization: Bearer client-secret" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "platformos.env.list"}'
```

## Tools Available

- `platformos.env.list` - List configured environments
- `platformos.graphql.execute` - Execute GraphQL queries

## Development

- `npm run dev` - Start with nodemon
- `npm run build` - TypeScript build
- `npm start` - Run built server
- `npm test` - Run tests

## Configuration

- `.pos/envs/*.json` - Environment credentials
- `clients.json` - Client API tokens
- `ADMIN_API_KEY` env var - Admin access

## Next Steps

1. Implement direct pos-cli lib imports (no subprocess)
2. Add nock-based tests for API wrappers
3. Expand tools: liquid.render, logs.fetch, data.export
4. Full MCP SDK integration