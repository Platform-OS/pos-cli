/**
 * The test endpoints (`/_tests/*`) are not part of the app_builder API, so they are fetched
 * directly rather than through the Gateway. `ctx.request` is the seam tests replace.
 */
export async function makeRequest(options) {
  const { uri, method = 'GET', headers = {} } = options;
  const response = await fetch(uri, { method, headers });
  const body = await response.text();
  return { statusCode: response.status, body };
}

// A trailing slash in `.pos` is ordinary, and `//_tests/run_async` is a different path to a
// strict server.
export const testsUrl = (instanceUrl, path) => `${String(instanceUrl).replace(/\/+$/, '')}${path}`;

/** The headers `/_tests/*` wants: the instance token, under both names it accepts. */
export const testAuthHeaders = token => ({ Authorization: `Token ${token}`, UserTemporaryToken: token });

export default makeRequest;
