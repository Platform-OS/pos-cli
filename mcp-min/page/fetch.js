/**
 * page-fetch — request a path on the instance over HTTP and report what came back.
 *
 * The one thing the admin GraphQL API cannot answer. `admin_pages { content }` proves the source is
 * on the instance; it does not prove the URL works, because routing, the layout, the authorization
 * policies and every partial the page renders sit between the two. "I deployed — is it live?" is
 * the commonest question after a deploy, and an evaluation of this server had to leave it to
 * answer that.
 *
 * **The instance is the resolved credentials' host and nothing else.** `path` is a path, checked
 * twice: it must begin with a single `/`, and the URL built from it must still have the same origin
 * the credentials do. That second check is the one that matters — it is the same comparison
 * `authForJob` makes — because a protocol-relative `//elsewhere.example.com` or an embedded scheme
 * is a path to a reader and another host to `new URL`. No argument may move a request
 * (`__tests__/request-target.test.js`); this one takes the strictest available reading of that.
 *
 * **No credentials are sent.** A visitor is what this is asking about: a page that only renders for
 * a holder of the instance API token is not a page that is live. It also means a redirect, which is
 * reported rather than followed, cannot carry a credential anywhere.
 */
import log from '../log.js';
import { resolveAuth } from '../auth.js';
import { ToolError } from '../tool-error.js';
import { authProperties } from '../schemas/auth.js';
import { cancelled } from '../cancellation.js';

/** A path, not a URL: one leading slash, and no scheme. `//host` is neither. */
const PATH = '^/(?!/).*$';

/**
 * What comes back is for a model to read, so it is bounded and it is text or it is not returned.
 * A platformOS page is HTML and an agent is checking for a marker in it; 16 KB holds a page's
 * worth of that without letting a bundled asset become the answer.
 */
export const MAX_BODY_BYTES = 16 * 1024;

// Anything else — an image, a zip, a font — is described rather than returned. `charset` and
// `+json`/`+xml` suffixes are why this is a test rather than a set.
const TEXTUAL = /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded)|[^;]*\+(json|xml)\b)/i;

const isTextual = (contentType) => TEXTUAL.test(String(contentType ?? '').trim());

/** The headers worth a model's tokens: what it would look at to explain a status. */
const REPORTED_HEADERS = ['content-type', 'location', 'cache-control', 'x-request-id'];

const headersOf = (response) => Object.fromEntries(
  REPORTED_HEADERS.map(name => [name, response.headers.get(name)]).filter(([, value]) => value !== null)
);

const bodyOf = (text) => {
  const bytes = Buffer.byteLength(text);
  if (bytes <= MAX_BODY_BYTES) return { body: text, bytes, truncated: false };

  // Cut by bytes, so the bound means what it says on a page that is not ASCII — and decoded with
  // `stream: true`, which holds back an incomplete sequence at the cut instead of replacing it.
  // `toString('utf8')` on the same slice emits U+FFFD, which is three bytes where one was dropped:
  // the result was both corrupt and *larger* than the ceiling it was enforcing.
  const decoder = new TextDecoder('utf-8');
  return { body: decoder.decode(Buffer.from(text).subarray(0, MAX_BODY_BYTES), { stream: true }), bytes, truncated: true };
};

const pageFetchTool = {
  description: 'Fetch a path on an instance over HTTP: status, headers and body, as a visitor gets it. This is how to confirm a deploy is live — reading the source back does not prove the URL works. No credentials are sent; a redirect is reported, not followed.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      path: { type: 'string', pattern: PATH, description: 'Path on the instance, starting with /, e.g. /eval-page. The host comes from the credentials.' }
    },
    required: ['path']
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);
    log.debug('tool:page-fetch invoked', { env: params?.env, path: params?.path });

    const origin = new URL(auth.url).origin;
    const target = new URL(params.path, origin);
    // The check the pattern cannot make. A `path` that resolved somewhere else is a redirected
    // request, which is the one thing no argument here is allowed to do.
    if (target.origin !== origin) {
      throw ToolError.input('PATH_NOT_ON_INSTANCE', `path must stay on ${origin}; that one resolves to ${target.origin}`);
    }

    if (ctx.signal?.aborted) throw cancelled();

    const fetcher = ctx.fetch ?? fetch;
    let response;
    try {
      response = await fetcher(target.href, { redirect: 'manual', signal: ctx.signal });
    } catch (err) {
      if (ctx.signal?.aborted) throw cancelled();
      // Reaches `classify`, which names the host and tells a DNS failure from a refused connection.
      throw Object.assign(new Error(err?.message ?? String(err)), { name: 'RequestError', cause: err, options: { uri: target.href } });
    }

    const contentType = response.headers.get('content-type');
    const textual = isTextual(contentType);
    // Read either way: an unread body leaves the socket open, and the length is worth reporting.
    const text = await response.text();
    const { body, bytes, truncated } = bodyOf(text);

    return {
      url: target.href,
      status: response.status,
      // `redirect: 'manual'` means a 3xx arrives here instead of being chased off the instance.
      // `headers.location` says where it points; following it is the caller's decision to make.
      redirected: response.status >= 300 && response.status < 400,
      headers: headersOf(response),
      contentBytes: bytes,
      ...(textual ? { body, truncated } : { bodyOmitted: `not text (${contentType ?? 'no content-type'})` })
    };
  }
};

export default pageFetchTool;
