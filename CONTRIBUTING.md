# Contributing Guide

## Development Workflow

```bash
git clone <repo>
cd pos-cli
npm ci
npm link          # run your checkout as the installed pos-cli
npm test          # vitest; see the Testing section of CLAUDE.md
```

## Adding a New MCP Tool

Tools live in `mcp-min/`, one directory per group, and are plain ES modules — a description, a
JSON Schema and a handler:

```javascript
// mcp-min/things/list.js
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';

const thingsListTool = {
  description: 'List the things on a platformOS instance.',
  annotations: { readOnlyHint: true },   // only if it changes nothing, locally or on the instance
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { env: { type: 'string' }, ...authProperties },
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);
    const gateway = new (ctx.Gateway || Gateway)({ url: auth.url, token: auth.token, email: auth.email });
    return { ok: true, data: await gateway.listThings() };
  }
};

export default thingsListTool;
```

1. **Register it** in `mcp-min/tools.js` — a `Map`, in the order clients see the tools. That alone
   puts it in the `full` profile; `mcp-min/profiles.js` decides whether it belongs in `dev` too.
2. **Describe it** in `mcp-min/tools.config.json`, which is the description clients actually see.
3. **Add tests** in `mcp-min/__tests__/`. `npm run test:mcp-min` needs no instance.
4. **Document it** in `docs/MCP_TOOLS.md` — a test fails if a registered tool is undocumented, or
   if a document names a tool that is not registered.

Rules worth knowing before you write the handler: the request URL comes from the resolved
credentials and never from a parameter; `env` stays optional and a closed schema must spread in
`authProperties`; nothing may be logged that could carry a credential (the logger redacts, but do
not hand it whole objects). CLAUDE.md's MCP section has the reasoning for each.

## Developing with Local platformos-tools

When working on `@platformos/*` packages (linter, LSP, parser, etc.) you can link a local
[platformos-tools](https://github.com/Platform-OS/platformos-tools) checkout into pos-cli
so that changes are picked up immediately without publishing to npm.

### Link

```bash
# Build platformos-tools first
cd /path/to/platformos-tools
yarn build

# Link all @platformos packages into pos-cli
npm run link:tools -- /path/to/platformos-tools
```

### Unlink

```bash
# Restore the npm-published versions
npm run unlink:tools
```

After linking, both `pos-cli check` and `pos-cli lsp` will use your local package code.
Remember to rebuild platformos-tools (`yarn build`) after making changes there.

## Before Opening a Pull Request

```bash
npm test                  # the whole suite (vitest)
npm run test:unit         # no instance needed
npm run test:mcp-min      # the MCP server's own suite, no instance needed
```

`test/integration` talks to a real platformOS instance and needs `MPKIT_URL`, `MPKIT_EMAIL` and
`MPKIT_TOKEN`; the other two do not. There is no lint or build step for the CLI itself — the GUI
apps under `gui/` are built separately and their output is committed.

## Release Process

1. `npm version patch/minor/major`
2. `npm publish`
3. Update [CHANGELOG.md](CHANGELOG.md)

## Code Standards

- **ES modules, plain JavaScript.** No build step, no TypeScript; JSDoc where a signature is not
  obvious from the code.
- **Schemas are JSON Schema, validated with Ajv** (`lib/validation/`). An MCP tool's schema is
  published to clients verbatim, so what is advertised and what is enforced are the same object.
- **Thin `bin/`, logic in `lib/`.** Commands parse arguments and delegate; `lib/proxy.js` is the
  one API client.
- **Cross-platform paths** — `path.join`/`path.sep`, never a hardcoded separator. CLAUDE.md has
  the patterns and the reasons.
- **A test that does not fail when the behaviour breaks is not a test.** For anything
  load-bearing, break the code on purpose and watch it catch that.

## Testing Layers

| Suite | Command | Needs an instance? |
|---|---|---|
| Unit | `npm run test:unit` | no |
| MCP server | `npm run test:mcp-min` | no — it spawns real servers and speaks the protocol to them |
| Integration | `npm run test:integration` | yes, `MPKIT_*` pointing at one you can write to |

Tests run in parallel, each file in its own process, so a test must not write into the repository
root — use a temp directory. `test/unit/test-isolation.test.js` enforces that.

---
**Questions? Open an issue!**