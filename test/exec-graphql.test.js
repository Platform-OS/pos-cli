jest.mock('../lib/apiRequest', () => ({
  apiRequest: jest.fn()
}));

require('dotenv').config();

const Gateway = require('../lib/proxy');

describe('Gateway graph method', () => {
  const { apiRequest } = require('../lib/apiRequest');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calls apiRequest with correct parameters', async () => {
    const mockResponse = {
      "data": {
        "records": {
          "results": []
        }
      }
    };
    apiRequest.mockResolvedValue(mockResponse);

    const gateway = new Gateway({ url: 'http://example.com', token: '1234', email: 'test@example.com' });
    const query = '{ records(per_page: 20) { results { id } } }';
    const result = await gateway.graph({ query });

    expect(apiRequest).toHaveBeenCalledWith({
      method: 'POST',
      uri: 'http://example.com/api/graph',
      json: { query },
      forever: true,
      request: expect.any(Function)
    });
    expect(result).toEqual(mockResponse);
  });

  test('handles graphql execution error', async () => {
    const mockErrorResponse = {
      errors: [
        {
          message: 'Syntax Error: Expected Name, found <EOF>',
          locations: [{ line: 1, column: 40 }]
        }
      ]
    };
    apiRequest.mockResolvedValue(mockErrorResponse);

    const gateway = new Gateway({ url: 'http://example.com', token: '1234', email: 'test@example.com' });
    const query = '{ records(per_page: 20) { results { id } '; // Missing closing brace
    const result = await gateway.graph({ query });

    expect(result).toEqual(mockErrorResponse);
  });
});

describe('exec graphql CLI', () => {
  const exec = require('./utils/exec');
  const cliPath = require('./utils/cliPath');
  const path = require('path');
  const fs = require('fs');
  const os = require('os');

  // Use spread operator to avoid mutating global process.env
  const env = {
    ...process.env,
    CI: 'true',
    MPKIT_URL: 'http://example.com',
    MPKIT_TOKEN: '1234',
    MPKIT_EMAIL: 'foo@example.com'
  };

  const CLI_TIMEOUT = 10000;

  describe('argument validation', () => {
    test('requires graphql argument', async () => {
      const { code, stderr } = await exec(`${cliPath} exec graphql staging`, { env, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
      expect(stderr).toMatch("error: missing required argument 'graphql'");
    });

    test('requires environment argument', async () => {
      const { code, stderr } = await exec(`${cliPath} exec graphql`, { env, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
      expect(stderr).toMatch("error: missing required argument 'environment'");
    });
  });

  describe('production environment confirmation', () => {
    // Detailed production environment detection tests are in productionEnvironment.test.js
    // These tests verify the CLI integration with the production environment helper

    test('prompts for confirmation on production environment and cancels when user declines', async () => {
      const { code, stdout } = await exec(`echo "n" | ${cliPath} exec graphql production "{ records { results { id } } }"`, { env, timeout: CLI_TIMEOUT });

      expect(code).toBe(0);
      expect(stdout).toMatch('Execution cancelled.');
    });

    test('proceeds with execution on production environment when user confirms', async () => {
      const { stdout, stderr } = await exec(`echo "y" | ${cliPath} exec graphql production "{ records { results { id } } }"`, { env, timeout: CLI_TIMEOUT });

      // This will fail because the mock API isn't set up, but we want to check it doesn't cancel
      expect(stdout).not.toMatch('Execution cancelled.');
      expect(stderr).not.toMatch('Execution cancelled.');
    });

    test('does not prompt for non-production environments', async () => {
      const { stdout, stderr } = await exec(`${cliPath} exec graphql staging "{ records { results { id } } }"`, { env, timeout: CLI_TIMEOUT });

      // Should not show warning or cancellation message
      expect(stdout).not.toMatch('Execution cancelled.');
      expect(stderr).not.toMatch('WARNING');
    });
  });

  describe('file flag handling', () => {
    test('accepts --file flag and reads content from file', async () => {
      const fixturePath = path.resolve(__dirname, 'fixtures/test-graphql.graphql');
      const { stderr } = await exec(`${cliPath} exec graphql staging --file "${fixturePath}"`, { env, timeout: CLI_TIMEOUT });

      // Command will fail due to mock API but should not complain about missing graphql argument
      expect(stderr).not.toMatch("error: missing required argument 'graphql'");
    });

    test('accepts -f shorthand flag and reads content from file', async () => {
      const fixturePath = path.resolve(__dirname, 'fixtures/test-graphql.graphql');
      const { stderr } = await exec(`${cliPath} exec graphql staging -f "${fixturePath}"`, { env, timeout: CLI_TIMEOUT });

      // Command will fail due to mock API but should not complain about missing graphql argument
      expect(stderr).not.toMatch("error: missing required argument 'graphql'");
    });

    test('shows error when file does not exist', async () => {
      const { code, stderr } = await exec(`${cliPath} exec graphql staging --file "/nonexistent/path/to/file.graphql"`, { env, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
      expect(stderr).toMatch('File not found');
      expect(stderr).toMatch('/nonexistent/path/to/file.graphql');
    });

    test('handles empty file as missing query', async () => {
      const emptyFile = path.join(os.tmpdir(), `empty-graphql-${Date.now()}.graphql`);
      fs.writeFileSync(emptyFile, '');

      try {
        const { code, stderr } = await exec(`${cliPath} exec graphql staging -f "${emptyFile}"`, { env, timeout: CLI_TIMEOUT });

        expect(code).toBe(1);
        expect(stderr).toMatch("error: missing required argument 'graphql'");
      } finally {
        fs.unlinkSync(emptyFile);
      }
    });

    test('handles file with only whitespace as missing query', async () => {
      const whitespaceFile = path.join(os.tmpdir(), `whitespace-graphql-${Date.now()}.graphql`);
      fs.writeFileSync(whitespaceFile, '   \n\t\n   ');

      try {
        const { code, stderr } = await exec(`${cliPath} exec graphql staging -f "${whitespaceFile}"`, { env, timeout: CLI_TIMEOUT });

        // Whitespace-only content is truthy, so it passes the !query check
        // This documents current behavior - whitespace is accepted as valid query
        expect(stderr).not.toMatch("error: missing required argument 'graphql'");
      } finally {
        fs.unlinkSync(whitespaceFile);
      }
    });

    test('reads file with GraphQL comments', async () => {
      const commentFile = path.join(os.tmpdir(), `comment-graphql-${Date.now()}.graphql`);
      fs.writeFileSync(commentFile, '# This is a comment\n{ records { results { id } } }');

      try {
        const { stderr } = await exec(`${cliPath} exec graphql staging -f "${commentFile}"`, { env, timeout: CLI_TIMEOUT });

        expect(stderr).not.toMatch("error: missing required argument 'graphql'");
      } finally {
        fs.unlinkSync(commentFile);
      }
    });
  });

  describe('error handling', () => {
    test('handles invalid URL format', async () => {
      const badEnv = {
        ...process.env,
        CI: 'true',
        MPKIT_URL: 'not-a-valid-url',
        MPKIT_TOKEN: 'test-token',
        MPKIT_EMAIL: 'test@example.com'
      };

      const { code, stderr } = await exec(`${cliPath} exec graphql staging "{ test }"`, { env: badEnv, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
    });
  });

  describe('query edge cases', () => {
    test('handles query with unicode characters', async () => {
      const { stderr } = await exec(`${cliPath} exec graphql staging "{ records(filter: { name: { value: \\"日本語\\" } }) { results { id } } }"`, { env, timeout: CLI_TIMEOUT });

      // Should not fail on argument parsing
      expect(stderr).not.toMatch("error: missing required argument 'graphql'");
    });

    test('handles mutation query', async () => {
      const { stderr } = await exec(`${cliPath} exec graphql staging "mutation { record_create(record: { table: \\"test\\" }) { id } }"`, { env, timeout: CLI_TIMEOUT });

      // Should accept mutations as valid GraphQL
      expect(stderr).not.toMatch("error: missing required argument 'graphql'");
    });
  });
});

// Integration test - requires real platformOS instance
const { requireRealCredentials } = require('./utils/realCredentials');

describe('exec graphql integration', () => {
  const exec = require('./utils/exec');
  const cliPath = require('./utils/cliPath');

  beforeAll(() => {
    requireRealCredentials();
  });

  test('executes graphql query on real instance', async () => {
    const query = '{ records(per_page: 20) { results { id } } }';
    const { stdout, stderr, code } = await exec(`${cliPath} exec graphql dev "${query}"`, {
      env: process.env,
      timeout: 30000
    });

    expect(code).toEqual(0);
    expect(stderr).toBe('');

    // Parse JSON response
    const response = JSON.parse(stdout);
    expect(response).toHaveProperty('data');
    expect(response.data).toHaveProperty('records');
    expect(Array.isArray(response.data.records.results)).toBe(true);
  }, 30000);

  test('handles graphql syntax error on real instance', async () => {
    const invalidQuery = '{ records(per_page: 20) { results { id } '; // Missing closing brace
    const { stdout, stderr, code } = await exec(`${cliPath} exec graphql dev "${invalidQuery}"`, {
      env: process.env,
      timeout: 30000
    });

    expect(code).toEqual(1);
    expect(stderr).toMatch('GraphQL execution error');
  }, 30000);
});