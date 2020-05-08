const request = require('request-promise'),
  errors = require('request-promise/errors');

const version = require('../package.json').version,
  logger = require('./logger'),
  ServerError = require('./ServerError');

class Gateway {
  constructor({ url, token, email }) {
    this.url = url;
    this.api_url = `${url}/api/app_builder`;
    this.private_api_url = `${url}/api/private`;

    const headers = {
      Authorization: `Token ${token}`,
      InstanceDomain: url,
      'User-Agent': `pos-cli/${version}`,
      From: email
    };

    const censored = Object.assign({}, headers, { Authorization: 'Token: <censored>' });
    logger.Debug(`Request headers: ${JSON.stringify(censored, null, 2)}`);

    this.authorizedRequest = request.defaults({ headers });
  }

  apiRequest({ method = 'GET', uri, formData, json = true, forever }) {
    logger.Debug(`[${method}] ${uri}`);
    return this.authorizedRequest({
      method,
      uri,
      formData,
      json,
      forever
    })
      .catch(errors.StatusCodeError, request => {
        switch (request.statusCode) {
          case 500:
            ServerError.internal(request);
            break;
          case 413:
            ServerError.entityTooLarge(request);
            break;
          case 422:
            ServerError.unprocessableEntity(request);
            break;
          case 404:
            ServerError.notFound(request);
            break;
          case 401:
            ServerError.unauthorized(request);
            break;
          default:
            ServerError.default(request);
        }
      })
      .catch(errors.RequestError, reason => {
        switch (reason.cause.code) {
          case "ENOTFOUND":
            ServerError.addressNotFound(reason);
            break;

          default:
            logger.Error('Request to the server failed.', { exit: false });
            logger.Error(`${reason.cause}`, { exit: false });
        }
      });
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
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/imports`, formData });
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

  ping() {
    return this.apiRequest({ uri: `${this.api_url}/logs` });
  }

  logs(json) {
    return this.apiRequest({ uri: `${this.api_url}/logs`, json, forever: true });
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
    return this.apiRequest({ method: 'POST', uri: `${this.api_url}/liquid_execution`, json, forever: true });
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
