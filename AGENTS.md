# AGENTS.md - pos-cli Development Guide

## Overview

pos-cli is a Node.js CLI tool (v22+) for deploying and managing platformOS applications. It uses ES modules, Commander.js for CLI commands, and Vitest for testing.

## Commands

### Installation & Build
```bash
npm ci                    # Install dependencies (clean install)
npm run build             # Build GUI assets (admin, graphql, next, liquid)
```

### Testing
```bash
npm test                  # Run all tests
npm run test:watch        # Run tests in watch mode
npm run test:unit         # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:coverage     # Run tests with coverage report
npm run test:mcp-min       # Run MCP server tests only
npx vitest run path/to/test.js  # Run single test file
npx vitest run -t "test name"    # Run single test by name
```

### Linting
```bash
npm run lint              # Check code style (fails on warnings)
npm run lint:fix          # Auto-fix linting issues
```

### Environment
Tests require `MPKIT_URL`, `MPKIT_EMAIL`, `MPKIT_TOKEN` environment variables for integration tests.

## Code Style Guidelines

### Imports & Modules
- Use ES modules (`import`/`export`) - this is an ESM package (`"type": "module"`)
- Use path aliases: `import Something from '#lib/something.js'`
- Use `import` for internal modules, `require()` only for Node.js built-ins when needed

### Formatting
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes (`'string'`), except to avoid escaping
- **Semicolons**: Required at end of statements
- **Line length**: Maximum 140 characters
- **Trailing commas**: Never use trailing commas

### Naming Conventions
- **Files**: kebab-case (`my-module.js`)
- **Classes**: PascalCase (`Gateway`, `ServerError`)
- **Variables/functions**: camelCase (`fetchSettings`, `deployStrategy`)
- **Constants**: UPPER_SNAKE_CASE for true constants, otherwise camelCase
- **Private members**: No underscore prefix convention; use closures or WeakMaps if true privacy needed

### Parameters
- **NEVER use underscore-prefixed parameters** (`_param`): Custom ESLint rule warns on usage
- Parameters starting with `_` signal "unused" - if you use it, remove the underscore
- Exception: `__dirname`, `__filename` are Node.js built-ins

### Functions
- Use arrow functions for callbacks, method shorthand for object methods
- Use async/await for all async operations (no callback-style code)
- Keep functions small and focused (single responsibility)

### Error Handling
- Use `try/catch` with async/await
- Throw `Error` objects with descriptive messages
- Use `ServerError` class from `lib/ServerError.js` for API errors
- Let errors bubble up; handle at appropriate level (CLI commands exit on error)
- Never swallow errors silently (at minimum, log them)

### Code Patterns

**Command files** (`bin/*.js`): Thin wrappers using Commander.js
- Parse arguments
- Fetch auth settings via `fetchSettings()`
- Delegate to lib/ modules

**Implementation** (`lib/`): Core business logic
- Gateway class for all API communication
- Strategy pattern for deployment (see `lib/deploy/`)
- Template processing with Mustache for module configuration

**MCP Server** (`mcp-min/`): Model Context Protocol server
- Tool definitions in modular files under feature directories
- Stdio and HTTP transports for MCP communication
- SSE streaming for real-time updates
- Partner Portal API tools for instance management

**Testing**:
- Unit tests in `test/unit/`
- Integration tests in `test/integration/`
- MCP server tests in `mcp-min/__tests__/`
- Use `describe()`, `test()`, `expect()` from Vitest
- Fixtures in `test/fixtures/`

### File Structure
```
pos-cli/
├── bin/              # CLI entry points (54 executables)
├── lib/              # Core implementation
│   ├── proxy.js      # Gateway API client
│   ├── ServerError.js
│   ├── settings.js   # Environment config (.pos file)
│   └── deploy/       # Deployment strategies
├── gui/              # Pre-built web apps (admin, graphql, liquid, next)
├── mcp-min/          # MCP server implementation
│   ├── tools.js      # Tool definitions
│   ├── index.js      # Server entry point
│   ├── stdio-server.js
│   ├── http-server.js
│   ├── sse.js        # Server-sent events
│   └── portal/       # Partner Portal API tools
├── test/             # Tests and fixtures
└── scripts/          # Utility scripts
```

### Important Notes
- GUI directories contain pre-built apps - don't edit source there
- Configuration stored in `.pos` file (JSON format)
- `.posignore` uses gitignore syntax for sync/deploy exclusions
- Environment variables: `CI`, `DEBUG`, `NO_COLOR`, `CONCURRENCY` affect behavior
- When fixing bugs, add or update tests to prevent regressions
