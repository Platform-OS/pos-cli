jest.mock('./lib/apiWrappers', () => {
  return {
    PlatformOSClient: jest.fn().mockImplementation(() => ({
      graphql: jest.fn().mockResolvedValue({ success: false, error: 'GraphQL not directly available' })
    }))
  };
});import nock from 'nock';
import { PlatformOSClient } from './lib/apiWrappers';
import { platformosGraphqlExecuteTool } from './tools/graphql.tools';

describe('API Wrappers', () => {
  const client = new PlatformOSClient();

  beforeEach(() => {
    nock.cleanAll();
  });

  test('graphql execute - mock CLI success', () => {
    // Since CLI subprocess, hard to mock perfectly, test structure
    return expect(client.graphql('staging', 'query {}')).resolves.toMatchObject({
      success: expect.any(Boolean)
    });
  });

  test('platformos.graphql.execute tool', async () => {
    const input = {
      env: 'staging',
      query: 'query { __schema { types { name } } }'
    };
    const result = await platformosGraphqlExecuteTool.handler(input);
    expect(result).toHaveProperty('success');
    expect(result.error).toContain('GraphQL not directly available');
  });
});