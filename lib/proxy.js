const request = require('request-promise'),
  version = require('../package.json').version,
  logger = require('./kit').logger,
  ServerError = require('./ServerError');

class Gateway {
  constructor({ url, token, email }) {
    this.url = url;
    this.api_url = `${url}api/marketplace_builder`;

    const headers = {
      Authorization: `Token ${token}`,
      'User-Agent': `marketplace-kit/${version}`,
      From: email
    };

    this.authorizedRequest = request.defaults({ headers, json: true });

    logger.Debug(`Request headers: ${JSON.stringify(headers, null, 2)}`);
  }

  apiRequest({ method = 'GET', uri, formData = {}, qs = '' }) {
    logger.Print('\n');
    logger.Debug(`[${method}] ${uri}`);
    return this.authorizedRequest({
      method,
      uri,
      formData,
      qs
    })
      .catch({ statusCode: 500 }, ServerError.internal)
      .catch({ statusCode: 401 }, ServerError.unauthorized);
  }

  ping() {
    return this.apiRequest({ uri: `${this.api_url}/logs` });
  }

  getStatus(id) {
    return this.apiRequest({ uri: `${this.api_url}/marketplace_releases/${id}` });
  }

  logs({ lastId }) {
    return this.apiRequest({ uri: `${this.api_url}/logs`, qs: { last_id: lastId } });
  }

  graph(body) {
    return this.apiRequest({ method: 'POST', uri: `${this.url}/api/graph`, body });
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
