# Contributing Guide

## Development Workflow

```bash
git clone <repo>
cd mcp
npm ci
npm run dev
```

## Adding a New Tool

1. **Create `src/tools/new.tools.ts`**:
```typescript
export const myTool: Tool = {
  name: 'platformos.my.tool',
  description: 'Does X',
  inputSchema: z.object({ foo: z.string() }),
  handler: async (input) => ({ result: input.foo.toUpperCase() })
};
export const myTools = [myTool];
```

2. **Register in `src/tools/index.ts`**:
```typescript
export const allTools = [
  ...environmentTools,
  ...myTools,
  // ...
];
```

3. **Add tests** `src/__tests__/my.tools.test.ts`
4. **Update** [TOOLS.md](TOOLS.md)

## Pre-commit Hooks

```bash
npm run lint
npm run test
npm run build
```

## Release Process

1. `npm version patch/minor/major`
2. `npm publish`
3. Update [CHANGELOG.md](CHANGELOG.md)

## Code Standards

- **TypeScript strict**
- **Zod for all schemas**
- **90%+ test coverage**
- **No `any` types**
- **JSDoc for complex functions**

## Testing Layers

| Type | Command | Purpose |
|------|---------|---------|
| Unit | `npm test` | Tool handlers, wrappers |
| Integration | `npm test` | Express endpoints |
| E2E | Manual | nock + real flows |

---
**Questions? Open an issue!**","path":"CONTRIBUTING.md