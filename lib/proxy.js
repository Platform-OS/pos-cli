import { apiRequest } from './apiRequest.js';
import logger from './logger.js';
import Portal from './portal.js';
import { needsTwoFactorSession, readSession, startSession } from './twoFactorSession.js';
import pkg from '../package.json' with { type: 'json' };
const version = pkg.version;

class Gateway {
  constructor({ url, token, email, partner_portal_url }, client) {
    this.url = url;
    this.api_url = `${url}/api/app_builder`;
    this.private_api_url = `${url}/api/private`;
    this.client = client;
    this.token = token;
    // Falls back to PARTNER_PORTAL_HOST / the public default so the session cache key is
    // the same whether the caller passed the environment's settings object straight in or
    // rebuilt it as MARKETPLACE_* env vars along the way (sync and the GUI server do).
    this.partnerPortalUrl = partner_portal_url || Portal.url();

    this.defaultHeaders = {
      Authorization: `Token ${token}`,
      InstanceDomain: url,
      'User-Agent': `pos-cli/${version}`,
      From: email
    };

    const censored = Object.assign({}, this.defaultHeaders, { Authorization: 'Token: <censored>' });
    logger.Debug(`Request headers: ${JSON.stringify(censored, null, 2)}`);
  }

  // The credential to present: a two-factor session when one is in force for this
  // instance, otherwise the long-lived token from .pos. Read per request rather than
  // cached on the instance so a session started mid-`sync` is picked up by the next call.
  authorizationHeader() {
    const session = readSession(this.partnerPortalUrl, this.url);
    return { Authorization: `Token ${session ? session.token : this.token}` };
  }

  // Every Gateway request goes through here so there is exactly one place that knows how
  // to answer an Instance asking for a second factor: step up with the Portal, then retry
  // the request that was refused. Only the two_factor_required body triggers it, so an
  // expired or revoked token still fails as the authentication error it is.
  async apiRequest(options) {
    const withAuth = () => ({ ...options, headers: { ...options.headers, ...this.authorizationHeader() } });

    try {
      return await apiRequest(withAuth());
    } catch (error) {
      if (!needsTwoFactorSession(error)) throw error;

      await startSession({
        portalUrl: this.partnerPortalUrl,
        instanceUrl: this.url,
        token: this.token
      });

      return apiRequest(withAuth());
    }
  }

  cloneInstanceStatus(id) {
    return this.apiRequest({ method: 'GET', uri: `${this.api_url}/instance_clone_imports/${id}`, headers: this.defaultHeaders });
  }

  cloneInstanceInit(formData = {}) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/instance_clone_imports`, json: formData, headers: this.defaultHeaders });
  }

  cloneInstanceExport(formData = {}) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/instance_clone_exports`, json: formData, headers: this.defaultHeaders });
  }

  appExportStart(formData = {}) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/marketplace_releases/backup`, formData, headers: this.defaultHeaders });
  }

  appExportStatus(id) {
    return this.apiRequest({ uri: `${this.api_url}/marketplace_releases/${id}`, headers: this.defaultHeaders });
  }

  dataExportStart(export_internal, csv_import = false) {
    const formData = { export_internal: String(export_internal) };
    let uri = `${this.api_url}/exports`;
    if (csv_import) {
      uri += '?csv_export=true';
    }
    return this.apiRequest({ method: 'POST', uri, formData, headers: this.defaultHeaders });
  }

  dataExportStatus(id, csv_import = false) {
    let uri = `${this.api_url}/exports/${id}`;
    if (csv_import) {
      uri += '?csv_export=true';
    }
    return this.apiRequest({ uri, headers: this.defaultHeaders });
  }

  dataImportStart(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/imports`, json: formData, headers: this.defaultHeaders });
  }

  dataImportStatus(id, csv_import = false) {
    let uri = `${this.api_url}/imports/${id}`;
    if (csv_import) {
      uri += '?csv_import=true';
    }
    return this.apiRequest({ uri, headers: this.defaultHeaders });
  }

  dataUpdate(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/data_updates`, formData, headers: this.defaultHeaders });
  }

  dataClean(confirmation, include_schema) {
    const uri = `${this.api_url}/data_clean`;
    return this.apiRequest({
      method: 'POST',
      uri,
      json: { confirmation, include_schema },
      headers: this.defaultHeaders
    });
  }

  dataCleanStatus(id) {
    return this.apiRequest({ method: 'GET', uri: `${this.api_url}/data_clean/${id}`, headers: this.defaultHeaders });
  }

  ping() {
    return this.apiRequest({ uri: `${this.api_url}/logs`, headers: this.defaultHeaders });
  }

  logs(json, { signal } = {}) {
    return this.apiRequest({ uri: `${this.api_url}/logs?last_id=${json.lastId}`, json: true, forever: true, headers: this.defaultHeaders, signal });
  }

  logsv2(params) {
    if(params.query) {
      return this.client.searchSQLByQuery(params);
    } else if(params.key) {
      return this.client.searchAround(params);
    } else {
      return this.client.searchSQL(params);
    }
  }

  getInstance() {
    return this.apiRequest({ uri: `${this.api_url}/instance`, headers: this.defaultHeaders });
  }

  getStatus(id) {
    return this.apiRequest({ uri: `${this.api_url}/marketplace_releases/${id}`, forever: true, headers: this.defaultHeaders });
  }

  graph(json) {
    return this.apiRequest({ method: 'POST', uri: `${this.url}/api/graph`, json, forever: true, headers: this.defaultHeaders });
  }

  liquid(json) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/liquid_exec`, json, forever: true, headers: this.defaultHeaders });
  }

  test(name) {
    return this.apiRequest({ uri: `${this.url}/_tests/run.js?name=${name}`, headers: this.defaultHeaders });
  }

  testRunAsync() {
    return this.apiRequest({ uri: `${this.url}/_tests/run_async`, headers: this.defaultHeaders });
  }

  listModules() {
    return this.apiRequest({ uri: `${this.api_url}/installed_modules`, headers: this.defaultHeaders });
  }

  removeModule(formData) {
    return this.apiRequest({ method: 'DELETE', uri: `${this.api_url}/installed_modules`, formData, headers: this.defaultHeaders });
  }

  listMigrations() {
    return this.apiRequest({ uri: `${this.api_url}/migrations`, headers: this.defaultHeaders });
  }

  generateMigration(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/migrations`, formData, headers: this.defaultHeaders });
  }

  runMigration(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/migrations/run`, formData, headers: this.defaultHeaders });
  }

  sendManifest(manifest, releaseId) {
    const json = { manifest };
    if (releaseId) json.marketplace_release_id = releaseId;
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/assets_manifest`, json, headers: this.defaultHeaders });
  }

  sync(formData) {
    return this.apiRequest({
      method: 'PUT',
      uri: `${this.api_url}/marketplace_releases/sync`,
      formData,
      forever: true,
      headers: this.defaultHeaders
    });
  }

  delete(formData) {
    return this.apiRequest({
      method: 'DELETE',
      uri: `${this.api_url}/marketplace_releases/sync`,
      formData,
      forever: true,
      headers: this.defaultHeaders
    });
  }

  push(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/marketplace_releases`, formData, headers: this.defaultHeaders });
  }
}

export default Gateway;
