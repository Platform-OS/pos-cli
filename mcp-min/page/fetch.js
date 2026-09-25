/**
 * page-fetch — request a path on the instance over HTTP and report what came back.
 *
 * The one thing the admin GraphQL API cannot answer: `admin_pages { content }` proves the source is
 * on the instance, not that the URL works, because routing, the layout, the authorization policies
 * and every partial the page renders sit between the two.
 *
 * **The instance is the resolved credentials' host and nothing else.** `path` is checked twice: it
 * must begin with a single `/`, and the URL built from it must still have the credentials' origin.
 * The second check is the one that holds the rule — `//host`, `/\host` and `/<tab>/host` all read as
 * paths and are other hosts to `new URL`.
 *
 * **No credentials are sent**, so none are asked for. A page that renders only for a holder of the
 * instance token is not a page that is live, and a redirect — reported, never followed — cannot
 * carry one off the instance. `url` therefore stands alone here rather than with `email` and
 * `token`: this is the one tool whose schema does not spread `authProperties` whole, because the
 * shared `url` says "with email and token", which on this tool would be false.
 */
import log from '../log.js';
import { resolveAuth } from '../auth.js';
import { ToolError } from '../tool-error.js';
// The same bound every other request gets: a page runs Liquid, so it is the likeliest to hang.
import { responseDeadline, timedOut, RESPONSE_TIMEOUT_MS } from '../../lib/apiRequest.js';
import { authProperties } from '../schemas/auth.js';
import { cancelled } from '../cancellation.js';

/** A path, not a URL: one leading slash, and no scheme. `//host` is neither. */
const PATH = '^/(?!/).*$';

/** A page's worth of markup, without letting a bundled asset become the answer. */
export const MAX_BODY_BYTES = 16 * 1024;

// `charset` and `+json`/`+xml` suffixes are why this is a test rather than a set.
const TEXTUAL = /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded)|[^;]*\+(json|xml)\b)/i;

const isTextual = (contentType) => TEXTUAL.test(String(contentType ?? '').trim());

/** The headers worth a model's tokens: what it would look at to explain a status. */
const REPORTED_HEADERS = ['content-type', 'location', 'cache-control', 'x-request-id'];

const headersOf = (response) => Object.fromEntries(
  REPORTED_HEADERS.map(name => [name, response.headers.get(name)]).filter(([, value]) => value !== null)
);

// `Number(null)` is 0, so an absent header would otherwise report a body of no bytes.
const declaredBytes = (response) => {
  const header = response.headers.get('content-length');
  const value = Number(header);
  return header && Number.isInteger(value) && value >= 0 ? value : null;
};

const bodyOf = (text) => {
  const bytes = Buffer.byteLength(text);
  if (bytes <= MAX_BODY_BYTES) return { body: text, bytes, truncated: false };

  // Cut by bytes, and decoded with `stream: true` so an incomplete sequence at the cut is held back
  // rather than replaced: `toString('utf8')` emits U+FFFD there, three bytes where one was dropped,
  // which left the bounded body both corrupt and over the ceiling it was enforcing.
  const decoder = new TextDecoder('utf-8');
  return { body: decoder.decode(Buffer.from(text).subarray(0, MAX_BODY_BYTES), { stream: true }), bytes, truncated: true };
};

const pageFetchTool = {
  description: 'Fetch a path on an instance over HTTP: status, headers and body, as a visitor gets it. This is how to confirm a deploy is live — reading the source back does not prove the URL works. No credentials are sent; a redirect is reported, not followed.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: authProperties.env,
      url: { type: 'string', format: 'uri', description: 'Base URL to fetch from, used instead of env. Any host — commonly the instance asset host. Needs no email or token: this tool sends none.' },
      path: { type: 'string', pattern: PATH, description: 'Path on the instance, starting with /, e.g. /eval-page.' }
    },
    required: ['path']
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx, { anonymous: true });
    log.debug('tool:page-fetch invoked', { env: params?.env, path: params?.path });

    const origin = new URL(auth.url).origin;
    const target = new URL(params.path, origin);
    // The check the pattern cannot make, and the one no argument may defeat: a path that resolved
    // somewhere else is a redirected request.
    if (target.origin !== origin) {
      throw ToolError.input('PATH_NOT_ON_INSTANCE', `path must stay on ${origin}; that one resolves to ${target.origin}`);
    }

    if (ctx.signal?.aborted) throw cancelled();

    const fetcher = ctx.fetch ?? fetch;
    const deadline = responseDeadline({ signal: ctx.signal });
    let response;
    try {
      response = await fetcher(target.href, { redirect: 'manual', signal: deadline.signal });
    } catch (err) {
      if (ctx.signal?.aborted) throw cancelled();
      // Both reach `classify`, which names the host and tells a timeout from a refused connection.
      if (deadline.reached()) throw timedOut(target.href, RESPONSE_TIMEOUT_MS, err);
      throw Object.assign(new Error(err?.message ?? String(err)), { name: 'RequestError', cause: err, options: { uri: target.href } });
    } finally {
      deadline.clear();
    }

    const contentType = response.headers.get('content-type');
    const textual = isTextual(contentType);
    // `redirect: 'manual'` means a 3xx arrives here instead of being chased off the instance;
    // `headers.location` says where it points. Named `isRedirect` because `redirected` on a
    // Response means the opposite — that one *was* followed.
    const common = {
      url: target.href,
      status: response.status,
      isRedirect: response.status >= 300 && response.status < 400,
      headers: headersOf(response)
    };
    // An image, a zip or a font is described rather than returned.
    const omitted = { bodyOmitted: `not text (${contentType ?? 'no content-type'})` };

    // Its size is then the whole answer, so a declared length means those bytes need never be
    // pulled into this process at all.
    const declared = textual ? null : declaredBytes(response);
    if (declared !== null) {
      await response.body?.cancel().catch(() => {});
      return { ...common, contentBytes: declared, ...omitted };
    }

    // Read either way: an unread body leaves the socket open, and the length is worth reporting.
    const { body, bytes, truncated } = bodyOf(await response.text());

    return { ...common, contentBytes: bytes, ...(textual ? { body, truncated } : omitted) };
  }
};

export default pageFetchTool;
