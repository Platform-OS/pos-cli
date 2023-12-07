const requestPromise = require('request-promise');

const { apiRequest } = require('./apiRequest');
const logger = require('./logger');
const version = require('../package.json').version;
const Portal = require('./portal');

class Gateway {
  constructor({ url, token, email }, client) {
    this.url = url;
    this.api_url = `${url}/api/app_builder`;
    this.private_api_url = `${url}/api/private`;
    this.client = client;

    const headers = {
      Authorization: `Token ${token}`,
      InstanceDomain: url,
      'User-Agent': `pos-cli/${version}`,
      From: email
    };

    const censored = Object.assign({}, headers, { Authorization: 'Token: <censored>' });
    logger.Debug(`Request headers: ${JSON.stringify(censored, null, 2)}`);

    this.authorizedRequest = requestPromise.defaults({ headers });
  }

  apiRequest({ method = 'GET', uri, formData, json = true, forever }) {
    return apiRequest({method: method, uri: uri, formData: formData, json: json, forever: forever, request: this.authorizedRequest });
  }

  appExportStart(formData = {}) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/marketplace_releases/backup`, formData });
  }

  appExportStatus(id) {
    return this.apiRequest({ uri: `${this.api_url}/marketplace_releases/${id}` });
  }

  dataExportStart(export_internal, csv_import = false) {
    const formData = { export_internal };
    let uri = `${this.api_url}/exports`;
    if (csv_import) {
      uri += '?csv_export=true';
    }
    return this.apiRequest({ method: 'POST', uri, formData });
  }

  dataExportStatus(id, csv_import = false) {
    let uri = `${this.api_url}/exports/${id}`;
    if (csv_import) {
      uri += '?csv_export=true';
    }
    return this.apiRequest({ uri });
  }

  dataImportStart(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/imports`, json: formData });
  }

  dataImportStatus(id, csv_import = false) {
    let uri = `${this.api_url}/imports/${id}`;
    if (csv_import) {
      uri += '?csv_import=true';
    }
    return this.apiRequest({ uri });
  }

  dataUpdate(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/data_updates`, formData });
  }

  dataClean(confirmation, include_schema) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/data_clean`, json: { confirmation, include_schema } });
  }

  dataCleanStatus(id) {
    return this.apiRequest({ method: 'GET', uri: `${this.api_url}/data_clean/${id}` });
  }

  ping() {
    return this.apiRequest({ uri: `${this.api_url}/logs` });
  }

  logs(json) {
    return this.apiRequest({ uri: `${this.api_url}/logs?last_id=${json.lastId}`, json, forever: true });
  }

  logsv2(params) {
    const response = params?.key ? this.client.searchAround(params) : this.client.searchSQL(params);

    return response;
  }

  getInstance() {
    return this.apiRequest({ uri: `${this.api_url}/instance` });
  }

  getStatus(id) {
    return this.apiRequest({ uri: `${this.api_url}/marketplace_releases/${id}`, forever: true });
  }

  graph(json) {
    return this.apiRequest({ method: 'POST', uri: `${this.url}/api/graph`, json, forever: true });
  }

  liquid(json) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/liquid_exec`, json, forever: true });
  }

  listModules() {
    return this.apiRequest({ uri: `${this.api_url}/installed_modules` });
  }

  removeModule(formData) {
    return this.apiRequest({ method: 'DELETE', uri: `${this.api_url}/installed_modules`, formData });
  }

  listMigrations() {
    return this.apiRequest({ uri: `${this.api_url}/migrations` });
  }

  generateMigration(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/migrations`, formData });
  }

  runMigration(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/migrations/run`, formData });
  }

  sendManifest(manifest) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/assets_manifest`, json: { manifest } });
  }

  sync(formData) {
    return this.apiRequest({
      method: 'PUT',
      uri: `${this.api_url}/marketplace_releases/sync`,
      formData,
      forever: true
    });
  }

  delete(formData) {
    return this.apiRequest({
      method: 'DELETE',
      uri: `${this.api_url}/marketplace_releases/sync`,
      formData,
      forever: true
    });
  }

  push(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/marketplace_releases`, formData });
  }
}

module.exports = Gateway;
