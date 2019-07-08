const request = require('request-promise'),
  version = require('../package.json').version,
  logger = require('./logger'),
  ServerError = require('./ServerError');

class Gateway {
  constructor({ url, token, email }) {
    this.url = url;
    this.api_url = `${url}/api/marketplace_builder`;
    this.private_api_url = `${url}/api/private`;

    const headers = {
      Authorization: `Token ${token}`,
      'User-Agent': `marketplace-kit/${version}`,
      From: email
    };

    this.authorizedRequest = request.defaults({ headers });

    logger.Debug(`Request headers: ${JSON.stringify(headers, null, 2)}`);
  }

  apiRequest({ method = 'GET', uri, formData, json = true }) {
    logger.Debug(`[${method}] ${uri}`);
    return this.authorizedRequest({
      method,
      uri,
      formData,
      json: json
    })
      .catch({ statusCode: 500 }, ServerError.internal)
      .catch({ statusCode: 401 }, ServerError.unauthorized);
  }

  dataExportStart(exportInternalIds) {
    const formData = { export_internal: exportInternalIds };
    return this.apiRequest({ uri: `${this.api_url}/exports`, method: 'POST', formData });
  }

  dataExportStatus(exportId) {
    return this.apiRequest({ uri: `${this.api_url}/exports/${exportId}` });
  }

  dataImportStart(formData) {
    return this.apiRequest({ uri: `${this.api_url}/imports`, method: 'POST', formData });
  }

  dataImportStatus(importId) {
    return this.apiRequest({ uri: `${this.api_url}/imports/${importId}` });
  }

  dataUpdate(formData) {
    return this.apiRequest({ uri: `${this.api_url}/data_updates`, method: 'POST', formData });
  }

  dataClean(confirmation) {
    return this.apiRequest({ uri: `${this.api_url}/data_clean`, method: 'POST', json: { confirmation: confirmation } });
  }

  ping() {
    return this.apiRequest({ uri: `${this.api_url}/logs` });
  }

  logs(json) {
    return this.apiRequest({ uri: `${this.api_url}/logs`, json });
  }

  getInstance() {
    return this.apiRequest({ method: 'GET', uri: `${this.api_url}/instance` });
  }

  getStatus(id) {
    return this.apiRequest({ uri: `${this.api_url}/marketplace_releases/${id}` });
  }

  graph(json) {
    return this.apiRequest({ method: 'POST', uri: `${this.url}/api/graph`, json });
  }

  listModules() {
    return this.apiRequest({ uri: `${this.private_api_url}/modules` });
  }

  removeModule(formData) {
    return this.apiRequest({ method: 'DELETE', uri: `${this.private_api_url}/modules`, formData });
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
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/assets_manifest`, json: { manifest: manifest } });
  }

  sync(formData) {
    return this.apiRequest({ method: 'PUT', uri: `${this.api_url}/marketplace_releases/sync`, formData });
  }

  push(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/marketplace_releases`, formData });
  }
}

module.exports = Gateway;
