# Testing Guide for pos-cli

This document describes the testing architecture, conventions, and how to run and write tests.

## Overview

Tests are organized into two categories:

- **Unit tests** (`test/unit/`) - Fast, isolated tests that mock external dependencies
- **Integration tests** (`test/integration/`) - End-to-end tests that require real platformOS credentials

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests (fast, no credentials needed)
npm run test:unit

# Run only integration tests (requires credentials)
npm run test:integration

# Watch mode for development
npm run test:watch
```

## Test Framework

- **Test Runner**: [Vitest](https://vitest.dev/) v4.x
- **HTTP Mocking**: [nock](https://github.com/nock/nock) for intercepting HTTP requests
- **Module System**: ESM (ES Modules)

## Directory Structure

```
test/
├── unit/                    # Unit tests (mocked dependencies)
│   ├── sync.test.js         # shouldBeSynced function tests
│   ├── deploy.test.js       # Deploy logic tests with mocked API
│   ├── templates.test.js    # Template processing tests
│   ├── manifest.test.js     # Asset manifest generation
│   ├── dependencies.test.js # Module dependency resolution
│   └── lib/                 # Library-specific unit tests
├── integration/             # Integration tests (real API calls)
│   ├── deploy.test.js       # Full deploy workflow
│   ├── sync.test.js         # File sync with real instance
│   ├── modules-*.test.js    # Module operations
│   └── logs.test.js         # Log streaming
├── fixtures/                # Test data and project structures
│   ├── deploy/              # Deploy test projects
│   ├── modules/             # Module test data
│   └── audit/               # Audit rule test cases
└── utils/                   # Shared test utilities
    ├── credentials.js       # Credential management
    ├── exec.js              # CLI execution helper
    └── cliPath.js           # Path to CLI binary
```

## Writing Tests

### Unit Tests

Unit tests should:
- Mock all external dependencies (HTTP, file system when needed)
- Be fast (< 1 second per test)
- Test isolated functionality
- Not require environment credentials

```javascript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import nock from 'nock';

// Mock dependencies
vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn() }
}));

describe('Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
  });

  test('handles API response correctly', async () => {
    // Mock the HTTP call
    nock('https://example.com')
      .post('/api/app_builder/marketplace_releases')
      .reply(200, { id: 123, status: 'pending' });

    // Test the functionality
    const result = await someFunction();
    expect(result.id).toBe(123);
  });
});
```

### Integration Tests

Integration tests should:
- Import `dotenv/config` at the top to load credentials
- Call `requireRealCredentials()` at the start of tests needing real API
- Use extended timeouts for API operations
- Clean up any created resources

```javascript
import 'dotenv/config';
import { describe, test, expect, vi } from 'vitest';
import { requireRealCredentials } from '#test/utils/credentials';

vi.setConfig({ testTimeout: 40000 }); // Extended timeout

describe('Deploy', () => {
  test('deploys successfully', async () => {
    requireRealCredentials();

    // Test with real API
    const { stdout } = await exec(`${cliPath} deploy`);
    expect(stdout).toMatch('Deploy succeeded');
  });
});
```

## HTTP Mocking Strategy

### Approach: Record & Replay

We use HTTP mocking to create unit test versions of integration tests. This approach:

1. **Records** real API responses during integration test development
2. **Replays** those responses in unit tests for fast, reliable execution
3. **Allows** re-running against real APIs when needed for validation

### Libraries Evaluated

| Library | Description | Chosen |
|---------|-------------|--------|
| [nock](https://github.com/nock/nock) | HTTP mocking with declarative API | ✅ Primary |
| [MSW](https://mswjs.io/) | Network-level interception | Alternative |
| [Polly.JS](https://netflix.github.io/pollyjs/) | Record/replay with persistence | For complex scenarios |

We chose **nock** because:
- Simple, declarative API
- Native fetch support (via @mswjs/interceptors)
- Lightweight, no additional setup needed
- Well-suited for testing HTTP clients

### Mock Data Organization

Mock responses are stored alongside tests or in dedicated fixtures:

```
test/
├── unit/
│   ├── deploy.test.js
│   └── __mocks__/           # Recorded API responses
│       └── deploy/
│           ├── success.json
│           └── error.json
```

## Credential Management

### For Unit Tests

Use example credentials from `test/utils/credentials.js`:

```javascript
import { exampleCredentials } from '#test/utils/credentials';
// { MPKIT_URL: 'https://example.com', MPKIT_TOKEN: 'test-token', ... }
```

### For Integration Tests

1. Copy `.env.example` to `.env` (or create `.env`)
2. Set real credentials:

```bash
MPKIT_URL=https://your-instance.platformos.com
MPKIT_TOKEN=your-api-token
MPKIT_EMAIL=your@email.com
```

3. Tests will automatically load from `.env` via `dotenv/config`

## Configuration

### vitest.config.js

```javascript
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.{test,spec}.js'],
    setupFiles: ['./test/vitest-setup.js'],
    testTimeout: 10000,
    hookTimeout: 20000
  }
});
```

### Import Aliases

The project uses import aliases defined in `package.json`:

```javascript
import something from '#lib/module.js';     // → ./lib/module.js
import util from '#test/utils/file.js';      // → ./test/utils/file.js
```

## Migration Progress

### Status: Active Development

Converting integration tests to have unit test equivalents with HTTP mocks using nock.

| Integration Test | Unit Test Status | Unit Test File | Notes |
|-----------------|------------------|----------------|-------|
| deploy.test.js | ✅ Done | `test/unit/deploy.test.js` | Gateway API mocked (push, getStatus, getInstance, sendManifest) |
| sync.test.js | ✅ Partial | `test/unit/sync.test.js` | `shouldBeSynced` function fully tested |
| modules-*.test.js | ✅ Done | `test/unit/modules.test.js` | Portal API mocked (jwtToken, moduleVersions, findModules, etc.) |
| logs.test.js | ✅ Done | `test/unit/logs.test.js` | logs() and liquid() Gateway methods mocked |
| gui-serve.test.js | 🔴 Pending | | May not need mocking (local server) |
| test-run.test.js | 🔴 Pending | | Requires mocking test runner API |

### Unit Test Coverage Summary

New unit tests created with HTTP mocking:

- **`test/unit/deploy.test.js`** (14 tests)
  - Gateway API calls (push, getStatus, getInstance, sendManifest)
  - Error handling (401, 404, 500, network errors)
  - Presign URL functionality
  - Archive creation
  - Full deploy flow with mocks

- **`test/unit/modules.test.js`** (19 tests)
  - Portal.jwtToken() authentication
  - Portal.moduleVersions() version queries
  - Portal.findModules() module search
  - Portal.createVersion() version publishing
  - Device authorization flow
  - Module dependency resolution

- **`test/unit/logs.test.js`** (16 tests)
  - Gateway.logs() polling
  - Gateway.liquid() execution
  - Gateway.ping() health check
  - Error handling and log filtering

### Re-running Integration Tests

To validate unit test mocks against real API responses:

```bash
# Run integration tests to verify real API behavior
npm run test:integration

# Compare with unit tests
npm run test:unit
```

### Adding New Mocks

When adding tests for new API endpoints:

1. Run the integration test and capture real API responses
2. Create mock responses in your unit test file
3. Use nock to intercept the HTTP calls
4. Verify the unit test behavior matches integration test

## Best Practices

1. **Prefer unit tests** - They're faster and more reliable
2. **Integration tests for critical paths** - Deploy, sync, module operations
3. **Mock at the HTTP level** - Use nock to intercept fetch calls
4. **Keep mocks realistic** - Record from real API when possible
5. **Clean up after tests** - Reset mocks and restore state
6. **Use descriptive test names** - Document what's being tested

## Troubleshooting

### Tests failing with credential errors

- Unit tests: Make sure you're using mocks, not real API calls
- Integration tests: Check your `.env` file has valid credentials

### Timeouts

- Unit tests should be fast (< 1 second). If timing out, you may be missing a mock.
- Integration tests use extended timeouts. Increase if needed: `vi.setConfig({ testTimeout: 60000 })`

### Mock not matching

nock is strict about request matching. Debug with:

```javascript
nock.recorder.rec(); // Record actual requests
// Run your code
nock.recorder.play(); // See what was called
```
