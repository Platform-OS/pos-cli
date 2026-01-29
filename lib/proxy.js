import { apiRequest } from './apiRequest.js';
import logger from './logger.js';
import pkg from '../package.json' with { type: 'json' };
const version = pkg.version;

class Gateway {
  constructor({ url, token, email }, client) {
    this.url = url;
    this.api_url = `${url}/api/app_builder`;
    this.private_api_url = `${url}/api/private`;
    this.client = client;

    this.defaultHeaders = {
      Authorization: `Token ${token}`,
      InstanceDomain: url,
      'User-Agent': `pos-cli/${version}`,
      From: email
    };

    const censored = Object.assign({}, this.defaultHeaders, { Authorization: 'Token: <censored>' });
    logger.Debug(`Request headers: ${JSON.stringify(censored, null, 2)}`);
  }

  cloneInstanceStatus(id) {
    return apiRequest({ method: 'GET', uri: `${this.api_url}/instance_clone_imports/${id}`, headers: this.defaultHeaders });
  }

  cloneInstanceInit(formData = {}) {
    return apiRequest({ method: 'POST', uri: `${this.api_url}/instance_clone_imports`, json: formData, headers: this.defaultHeaders });
  }

  cloneInstanceExport(formData = {}) {
    return apiRequest({ method: 'POST', uri: `${this.api_url}/instance_clone_exports`, json: formData, headers: this.defaultHeaders });
  }

  appExportStart(formData = {}) {
    return apiRequest({ method: 'POST', uri: `${this.api_url}/marketplace_releases/backup`, formData, headers: this.defaultHeaders });
  }

  appExportStatus(id) {
    return apiRequest({ uri: `${this.api_url}/marketplace_releases/${id}`, headers: this.defaultHeaders });
  }

  dataExportStart(export_internal, csv_import = false) {
    const formData = { export_internal };
    let uri = `${this.api_url}/exports`;
    if (csv_import) {
      uri += '?csv_export=true';
    }
    return apiRequest({ method: 'POST', uri, formData, headers: this.defaultHeaders });
  }

  dataExportStatus(id, csv_import = false) {
    let uri = `${this.api_url}/exports/${id}`;
    if (csv_import) {
      uri += '?csv_export=true';
    }
    return apiRequest({ uri, headers: this.defaultHeaders });
  }

  dataImportStart(formData) {
    return apiRequest({ method: 'POST', uri: `${this.api_url}/imports`, json: formData, headers: this.defaultHeaders });
  }

  dataImportStatus(id, csv_import = false) {
    let uri = `${this.api_url}/imports/${id}`;
    if (csv_import) {
      uri += '?csv_import=true';
    }
    return apiRequest({ uri, headers: this.defaultHeaders });
  }

  dataUpdate(formData) {
    return apiRequest({ method: 'POST', uri: `${this.api_url}/data_updates`, formData, headers: this.defaultHeaders });
  }

  dataClean(confirmation, include_schema) {
    const uri = `${this.api_url}/data_clean`;
    return apiRequest({
      method: 'POST',
      uri,
      json: { confirmation, include_schema },
      headers: this.defaultHeaders
    });
  }

  dataCleanStatus(id) {
    return apiRequest({ method: 'GET', uri: `${this.api_url}/data_clean/${id}`, headers: this.defaultHeaders });
  }

  ping() {
    return apiRequest({ uri: `${this.api_url}/logs`, headers: this.defaultHeaders });
  }

  logs(json, { signal } = {}) {
    return apiRequest({ uri: `${this.api_url}/logs?last_id=${json.lastId}`, json: true, forever: true, headers: this.defaultHeaders, signal });
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
    return apiRequest({ uri: `${this.api_url}/instance`, headers: this.defaultHeaders });
  }

  getStatus(id) {
    return apiRequest({ uri: `${this.api_url}/marketplace_releases/${id}`, forever: true, headers: this.defaultHeaders });
  }

  graph(json) {
    return apiRequest({ method: 'POST', uri: `${this.url}/api/graph`, json, forever: true, headers: this.defaultHeaders });
  }

  liquid(json) {
    return apiRequest({ method: 'POST', uri: `${this.api_url}/liquid_exec`, json, forever: true, headers: this.defaultHeaders });
  }

  test(name) {
    return apiRequest({ uri: `${this.url}/_tests/run.js?name=${name}`, headers: this.defaultHeaders });
  }

  testRunAsync() {
    return apiRequest({ uri: `${this.url}/_tests/run_async`, headers: this.defaultHeaders });
  }

  listModules() {
    return apiRequest({ uri: `${this.api_url}/installed_modules`, headers: this.defaultHeaders });
  }

  removeModule(formData) {
    return apiRequest({ method: 'DELETE', uri: `${this.api_url}/installed_modules`, formData, headers: this.defaultHeaders });
  }

  listMigrations() {
    return apiRequest({ uri: `${this.api_url}/migrations`, headers: this.defaultHeaders });
  }

  generateMigration(formData) {
    return apiRequest({ method: 'POST', uri: `${this.api_url}/migrations`, formData, headers: this.defaultHeaders });
  }

  runMigration(formData) {
    return apiRequest({ method: 'POST', uri: `${this.api_url}/migrations/run`, formData, headers: this.defaultHeaders });
  }

  sendManifest(manifest) {
    return apiRequest({ method: 'POST', uri: `${this.api_url}/assets_manifest`, json: { manifest }, headers: this.defaultHeaders });
  }

  sync(formData) {
    return apiRequest({
      method: 'PUT',
      uri: `${this.api_url}/marketplace_releases/sync`,
      formData,
      forever: true,
      headers: this.defaultHeaders
    });
  }

  delete(formData) {
    return apiRequest({
      method: 'DELETE',
      uri: `${this.api_url}/marketplace_releases/sync`,
      formData,
      forever: true,
      headers: this.defaultHeaders
    });
  }

  push(formData) {
    return apiRequest({ method: 'POST', uri: `${this.api_url}/marketplace_releases`, formData, headers: this.defaultHeaders });
  }
}

export default Gateway;
