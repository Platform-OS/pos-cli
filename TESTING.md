Testing strategy for MCP components

Overview
--------
This document describes the testing approach, coverage goals, test matrix, recommended libraries, and instructions to run tests locally and in CI for the mcp-min (MCP minimal) components.

Goals
-----
- Provide deterministic unit tests for API wrappers, auth/config resolution, tools, and transport implementations (stdio, SSE).
- Provide integration tests for HTTP endpoints and JSON-RPC compatibility (/call, /call-stream) against a running mcp-min server.
- Achieve coverage thresholds for the mcp-min package and global project coverage.

Coverage targets
----------------
- Global: branches 70%, functions 75%, lines 80%, statements 80%
- mcp-min package: branches 80%, functions 85%, lines 90%, statements 90%

Test matrix (CI)
----------------
- Node versions: 18.x, 20.x
- OS: ubuntu-latest, macos-latest, windows-latest

Test types and cases
--------------------
Unit tests
- API wrapper classes: mock network responses, assert request shape, retries/error handling.
- Auth resolution: env vars, explicit params, .pos config precedence, missing auth errors.
- single-file helpers: normalizeLocalPath, computeRemotePath, isAssetsPath, masking tokens.
- Proxy-wrapper behavior: mock lib/proxy to ensure calls for sync/delete flow are invoked.
- Tools: echo (simple), list-envs (.pos parsing), sync.singleFile (dry-run path, validation failure, auth missing).
- stdio transport: parsing well-formed JSON-line, invalid JSON handling, unknown method errors.
- sse utilities: sseHandler framing, writeSSE escaping multiline data, heartbeat timing with fake timers.

Integration tests
- Start mcp-min HTTP server in tests and exercise endpoints: /health, /tools, /call (success, 400, 404), /call-stream (JSON-RPC initialize/tools/list/tools/call)
- SSE streaming behavior: GET / with Accept: text/event-stream handshake, POST /call-stream streaming response bodies and initial endpoint events.
- Full tool chaining: tools that call other libs (sync.singleFile) with proxy mocked and asserting writer events.
- Error recovery: simulate gateway errors and ensure server responds with appropriate error payloads.

End-to-end
- stdio + HTTP combined scenario where an external client uses JSON-RPC initialize, tools/list, and tools/call over HTTP and verifies SSE messages (using eventsource in real runs).

Mock framework & fixtures
-------------------------
- Use nock to mock HTTP calls to platformOS endpoints and S3 presign/upload flows.
- Use jest.mock for internal libs (lib/proxy, lib/s3UploadFile, lib/presignUrl, lib/files) to create deterministic responses.
- Use test/utils/fixtures.js for managing temporary .pos configs.
- Use tmp or fs-extra for temp directories and files.

Libraries recommended
---------------------
- jest (testing framework)
- supertest (HTTP assertions) - optional in existing tests; current code uses http.request
- eventsource (EventSource polyfill) or eventsource package for SSE client tests
- nock (HTTP mocking)
- tmp / fs-extra (filesystem helpers)
- jest fake timers for heartbeat and SSE tests

Jest config and coverage
------------------------
- collectCoverage true, target mcp-min and lib.
- Set coverage thresholds (see Coverage targets section).
- Add test path ignore for heavy gui/next etc.

CI job
------
- GitHub Actions workflow at .github/workflows/ci.yml
- Matrix: node 18, 20; OS: ubuntu, macos, windows
- Steps: checkout, setup-node, npm ci, npm test, upload coverage artifact

Files to add (initial PR)
-------------------------
- mcp-min/__tests__/http.test.js
- mcp-min/__tests__/sse.test.js
- mcp-min/__tests__/stdio.test.js
- mcp-min/__tests__/tools.test.js
- test/utils/fixtures.js
- .github/workflows/ci.yml
- TESTING.md
- package.json jest config updated with coverage settings

Running tests locally
---------------------
- npm ci
- npm test

Maintainer notes
----------------
- Expand tests to cover lib/proxy and network interactions using jest.mock + nock.
- Add integration tests that spin up a mocked S3 service if needed.
- Use supertest for more ergonomic HTTP assertions in future.
