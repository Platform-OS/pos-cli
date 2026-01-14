jest.mock('../lib/apiRequest', () => ({
  apiRequest: jest.fn()
}));

const Gateway = require('../lib/proxy');

describe('Gateway graph method', () => {
  const { apiRequest } = require('../lib/apiRequest');

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

  const env = Object.assign(process.env, {
    CI: true,
    MPKIT_URL: 'http://example.com',
    MPKIT_TOKEN: '1234',
    MPKIT_EMAIL: 'foo@example.com'
  });

  test('requires graphql argument', async () => {
    const { code, stderr } = await exec(`${cliPath} exec graphql staging`, { env });

    expect(code).toEqual(1);
    expect(stderr).toMatch("error: missing required argument 'graphql'");
  });

  test('cancels execution on production environment when user says no', async () => {
    const { code, stdout, stderr } = await exec(`echo "n" | ${cliPath} exec graphql production "{ records { results { id } } }"`, { env });

    expect(code).toEqual(0);
    expect(stdout).toMatch('Execution cancelled.');
  });

  test('proceeds with execution on production environment when user confirms', async () => {
    const { code, stdout, stderr } = await exec(`echo "y" | ${cliPath} exec graphql production "{ records { results { id } } }"`, { env });

    // This will fail because the mock API isn't set up, but we want to check it doesn't cancel
    expect(stdout).not.toMatch('Execution cancelled.');
    expect(stderr).not.toMatch('Execution cancelled.');
  });

  test('does not prompt for non-production environments', async () => {
    const { code, stdout, stderr } = await exec(`${cliPath} exec graphql staging "{ records { results { id } } }"`, { env });

    expect(stdout).not.toMatch('WARNING: You are executing GraphQL on a production environment');
    expect(stdout).not.toMatch('Execution cancelled.');
  });
});

// Integration test - requires real platformOS instance
describe('exec graphql integration', () => {
  const exec = require('./utils/exec');
  const cliPath = require('./utils/cliPath');

  // Only run if real credentials are available
  const hasRealCredentials = process.env.MPKIT_URL &&
                            process.env.MPKIT_TOKEN &&
                            !process.env.MPKIT_URL.includes('example.com');

  (hasRealCredentials ? test : test.skip)('executes graphql query on real instance', async () => {
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

  (hasRealCredentials ? test : test.skip)('handles graphql syntax error on real instance', async () => {
    const invalidQuery = '{ records(per_page: 20) { results { id } '; // Missing closing brace
    const { stdout, stderr, code } = await exec(`${cliPath} exec graphql dev "${invalidQuery}"`, {
      env: process.env,
      timeout: 30000
    });

    expect(code).toEqual(1);
    expect(stderr).toMatch('GraphQL execution error');
  }, 30000);
});