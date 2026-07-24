import { apiRequest } from '../apiRequest.js';

const DESTRUCTIVE_PREFIX = 'Destructive DNS change blocked';

// Canonical portal base url — auth.js compares portalUrl values (same-instance guard,
// protected-host check), so every construction path must normalize identically.
const normalizeBaseUrl = (url) => String(url).replace(/\/+$/, '');

class PortalAuthError extends Error {
  constructor(portalUrl) {
    super(
      `Not authorized on ${portalUrl} — the stored token is invalid or expired. ` +
      'Run `pos-cli env refresh-token <environment>` or pass --token/--email.'
    );
    this.name = 'PortalAuthError';
    this.portalUrl = portalUrl;
  }
}

class PortalAccessError extends Error {
  constructor(portalUrl, instanceUuid) {
    super(
      `Your user lacks write access to instance ${instanceUuid} on ${portalUrl}. ` +
      'Ask the instance owner to grant your portal user WRITE permission, or authenticate as a user that has it.'
    );
    this.name = 'PortalAccessError';
    this.portalUrl = portalUrl;
    this.instanceUuid = instanceUuid;
  }
}

class DestructiveChangeError extends Error {
  constructor(serverMessage, domainName) {
    super(serverMessage);
    this.name = 'DestructiveChangeError';
    this.domainName = domainName;
  }
}

class ReadOnlyPortalError extends Error {
  constructor(portalUrl, operation) {
    super(`Refusing ${operation} on ${portalUrl} — this portal is configured as a read-only source.`);
    this.name = 'ReadOnlyPortalError';
    this.portalUrl = portalUrl;
  }
}

// Any portal response pos-cli has no dedicated type for. The portal puts the real
// failure reason in the response body even for 500s (e.g. SetDomains validation:
// 'Name has to be unique, but "x" is in use by other instance.'), so the body
// messages MUST end up in .message — a bare 'Request failed with status 500'
// gives the operator nothing to act on.
class PortalRequestError extends Error {
  constructor({ method, path, statusCode, messages, domainName, instanceUuid }) {
    const detail = messages.length
      ? messages.join(' | ')
      : 'the portal returned no error details — check the portal logs';
    super(`${method} ${path} responded with status ${statusCode}: ${detail}`);
    this.name = 'PortalRequestError';
    this.statusCode = statusCode;
    this.messages = messages;
    this.domainName = domainName;
    this.instanceUuid = instanceUuid;
  }
}

// Flatten a Rails-style errors payload (string | array | nested object) into readable
// "path: message" strings. Strings inside plain arrays keep no index, so
// `errors: ["msg"]` yields exactly "msg" — the destructive/NotAuthorized matchers
// below rely on matching the unmodified server string.
const flattenMessages = (node, path = '') => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') {
    if (!node.trim()) return [];
    return [path ? `${path}: ${node}` : node];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item, index) =>
      flattenMessages(item, item && typeof item === 'object' ? `${path}[${index}]` : path));
  }
  if (typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      flattenMessages(value, path ? `${path}.${key}` : key));
  }
  return [path ? `${path}: ${String(node)}` : String(node)];
};

const serverMessages = (body) => {
  if (body === null || body === undefined) return [];
  if (typeof body === 'string') {
    const text = body.trim();
    // An HTML error page (crashed portal, proxy) has nothing quotable in it.
    if (!text || text.startsWith('<')) return [];
    return [text.length > 300 ? `${text.slice(0, 300)}…` : text];
  }
  return flattenMessages(body.errors ?? body.error ?? body.message);
};

// Actionable follow-ups for known server messages the raw text doesn't explain.
const MESSAGE_HINTS = [
  {
    pattern: /is in use by other instance/i,
    hint: 'The domain is already attached to a different instance on the target portal — remove it from that instance (or pass the correct target with --target-instance-uuid) and re-run.'
  }
];

class DnsPortalClient {
  constructor({ baseUrl, token, readOnly = false }) {
    if (!baseUrl) throw new Error('DnsPortalClient requires a baseUrl');
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token;
    this.readOnly = readOnly;
  }

  static async authenticate(baseUrl, email, password) {
    const base = normalizeBaseUrl(baseUrl);
    try {
      const response = await apiRequest({
        method: 'POST',
        uri: `${base}/api/authenticate`,
        body: { email, password }
      });
      if (!response || !response.auth_token) throw new PortalAuthError(base);
      return response.auth_token;
    } catch (error) {
      if (error.name === 'StatusCodeError' && error.statusCode === 401) throw new PortalAuthError(base);
      throw error;
    }
  }

  listInstances() {
    return this.request('GET', '/api/instances');
  }

  searchInstances({ domain }) {
    return this.request('GET', `/api/instances/search?domain=${encodeURIComponent(domain)}`);
  }

  listDomains(instanceUuid, { version = 2 } = {}) {
    const query = new URLSearchParams({ instance_uuid: instanceUuid, version: String(version) });
    return this.request('GET', `/api/domains?${query}`, { instanceUuid });
  }

  getDomain(name, instanceUuid, { version = 2 } = {}) {
    // The show action reads params[:name], but the route binds the path segment to
    // params[:id] (dots in domain names trigger format inference) — the name must
    // ALSO be passed as a query param or the portal responds 404 for every domain.
    const query = new URLSearchParams({ instance_uuid: instanceUuid, name, version: String(version) });
    return this.request('GET', `/api/domains/${encodeURIComponent(name)}?${query}`, { instanceUuid });
  }

  upsertDomain(payload) {
    this.assertWritable('POST /api/domains');
    return this.request('POST', '/api/domains', {
      instanceUuid: payload.instance_uuid,
      domainName: payload.name,
      body: payload
    });
  }

  refreshDomain(name, instanceUuid) {
    this.assertWritable(`POST /api/domains/${name}/refresh`);
    const query = new URLSearchParams({ instance_uuid: instanceUuid });
    return this.request('POST', `/api/domains/${encodeURIComponent(name)}/refresh?${query}`, {
      instanceUuid,
      domainName: name,
      body: {}
    });
  }

  assertWritable(operation) {
    if (this.readOnly) throw new ReadOnlyPortalError(this.baseUrl, operation);
  }

  async request(method, path, { instanceUuid, domainName, body } = {}) {
    try {
      return await apiRequest({
        method,
        uri: `${this.baseUrl}${path}`,
        headers: { Authorization: `Bearer ${this.token}` },
        ...(body ? { body } : {})
      });
    } catch (error) {
      throw this.mapError(error, { method, path, instanceUuid, domainName });
    }
  }

  mapError(error, { method, path, instanceUuid, domainName } = {}) {
    if (error.name !== 'StatusCodeError') return error;

    const responseBody = error.response && error.response.body;
    const messages = serverMessages(responseBody);

    if (error.statusCode === 401) return new PortalAuthError(this.baseUrl);
    if (messages.some(message => message.includes('NotAuthorized'))) {
      return new PortalAccessError(this.baseUrl, instanceUuid);
    }
    const destructive = error.statusCode === 422 && messages.find(message => message.startsWith(DESTRUCTIVE_PREFIX));
    if (destructive) return new DestructiveChangeError(destructive, domainName);

    const hints = MESSAGE_HINTS
      .filter(({ pattern }) => messages.some(message => pattern.test(message)))
      .map(({ hint }) => hint);
    return new PortalRequestError({
      method,
      path: (path || '').split('?')[0],
      statusCode: error.statusCode,
      messages: [...messages, ...hints],
      domainName,
      instanceUuid
    });
  }
}

export {
  DnsPortalClient,
  PortalAuthError,
  PortalAccessError,
  DestructiveChangeError,
  ReadOnlyPortalError,
  PortalRequestError,
  normalizeBaseUrl
};
