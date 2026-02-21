# pos-cli Integration Reference

## Architecture Overview

The MCP server integrates pos-cli as a **library**, not subprocess:

```
MCP Server → PlatformOSClient → pos-cli Gateway → platformOS API
```

### Key Integration Points

1. **`lib/apiWrappers.ts`** (pos-cli)
   - `PlatformOSClient` - Environment pooling, auth refresh
   - `GraphQLWrapper` - `gateway.graph()`
   - Direct HTTP wrappers for Liquid, logs, data export

2. **No Subprocess Spawning**
   - Pure Node.js imports: `require('../../lib/apiWrappers')`
   - Shared `.pos/envs/` storage
   - Same credential format

3. **Tool Mappings**

| MCP Tool | pos-cli Method |
|----------|----------------|
| `env.list` | `FsStorage.listEnvs()` |
| `graphql.execute` | `client.graphql(env, query)` |
| `liquid.render` | `client.liquidRender(env, template)` |
| `data.export_start` | `client.dataExportStart()` |

## Setup for pos-cli Users

Your existing `.pos/envs/*.json` files work **automatically**!

```bash
# Same config as pos-cli
cd your-pos-cli-project
cp -r .pos mcp-project/
cp clients.json mcp-project/  # MCP clients
cd mcp-project
npm run dev
```

## Extensibility

Add new tools by wrapping pos-cli methods:

```typescript
// src/tools/deploy.tools.ts
const deployTool: Tool = {
  name: 'platformos.deploy',
  inputSchema: z.object({ env: z.string() }),
  handler: async ({ env }) => {
    const client = new PlatformOSClient();
    return await client.deploy(env);  // Reuse pos-cli deploy logic
  }
};
```

---
**MCP = pos-cli + AI-friendly HTTP tools**","path":"docs/POS-CLI.md