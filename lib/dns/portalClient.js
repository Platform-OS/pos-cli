import { apiRequest } from '../apiRequest.js';

const DESTRUCTIVE_PREFIX = 'Destructive DNS change blocked';

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

const errorsArray = (body) => {
  const errors = body && body.errors;
  if (Array.isArray(errors)) return errors.filter(e => typeof e === 'string');
  return [];
};

class DnsPortalClient {
  constructor({ baseUrl, token, readOnly = false }) {
    if (!baseUrl) throw new Error('DnsPortalClient requires a baseUrl');
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.token = token;
    this.readOnly = readOnly;
  }

  static async authenticate(baseUrl, email, password) {
    const base = String(baseUrl).replace(/\/+$/, '');
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
      throw this.mapError(error, { instanceUuid, domainName });
    }
  }

  mapError(error, { instanceUuid, domainName } = {}) {
    if (error.name !== 'StatusCodeError') return error;

    const responseBody = error.response && error.response.body;
    const errors = errorsArray(responseBody);

    if (error.statusCode === 401) return new PortalAuthError(this.baseUrl);
    if (errors.some(message => message.includes('NotAuthorized'))) {
      return new PortalAccessError(this.baseUrl, instanceUuid);
    }
    if (error.statusCode === 422 && errors.some(message => message.startsWith(DESTRUCTIVE_PREFIX))) {
      const serverMessage = errors.find(message => message.startsWith(DESTRUCTIVE_PREFIX));
      return new DestructiveChangeError(serverMessage, domainName);
    }
    return error;
  }
}

export {
  DnsPortalClient,
  PortalAuthError,
  PortalAccessError,
  DestructiveChangeError,
  ReadOnlyPortalError,
  DESTRUCTIVE_PREFIX
};
