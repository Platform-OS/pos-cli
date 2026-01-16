Testing instructions for MCP server

Run tests:

  cd mcp
  npm ci
  npm test

Coverage:

  npm test -- --coverage

CI: see .github/workflows/test.yml

Test structure:

  src/__tests__ - unit and integration tests
  src/tools - tool unit tests
  src/storage - storage tests

Mocks: jest + nock for HTTP
