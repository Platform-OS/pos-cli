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

  dataExportStart() {
    return this.apiRequest({ uri: `${this.api_url}/exports`, method: 'POST' });
  }

  dataExportStatus(exportId) {
    return this.apiRequest({ uri: `${this.api_url}/exports/${exportId}` });
  }

  dataImport(json) {
    return this.apiRequest({ uri: `${this.api_url}/imports`, method: 'POST', json: { import: { data: json } } });
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

  sync(formData) {
    return this.apiRequest({ method: 'PUT', uri: `${this.api_url}/marketplace_releases/sync`, formData });
  }

  push(formData) {
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/marketplace_releases`, formData });
  }
}

module.exports = Gateway;
