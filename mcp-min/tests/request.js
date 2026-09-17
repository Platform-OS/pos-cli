/**
 * The test endpoints (`/_tests/*`) are not part of the app_builder API, so they are fetched
 * directly rather than through the Gateway. One definition, because the async test tools and
 * `job-status` all read the same endpoint and `ctx.request` is the seam every test replaces.
 */
export async function makeRequest(options) {
  const { uri, method = 'GET', headers = {} } = options;
  const response = await fetch(uri, { method, headers });
  const body = await response.text();
  return { statusCode: response.status, body };
}

/**
 * A `/_tests/*` URL on an instance. The instance URL comes from `.pos`, where a trailing slash is
 * ordinary, and `https://x.example.com//_tests/run_async` is a different path to a strict server.
 */
export const testsUrl = (instanceUrl, path) => `${String(instanceUrl).replace(/\/+$/, '')}${path}`;

/** The headers `/_tests/*` wants: the instance token, under both names it accepts. */
export const testAuthHeaders = token => ({ Authorization: `Token ${token}`, UserTemporaryToken: token });

export default makeRequest;
