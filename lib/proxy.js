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

  ping() {
    return this.authorizedRequest({
      uri: `${this.api_url}/logs`
    })
      .catch({ statusCode: 500 }, ServerError.internal)
      .catch({ statusCode: 401 }, ServerError.unauthorized);
  }

  getStatus(id) {
    return this.authorizedRequest({
      uri: `${this.api_url}/marketplace_releases/${id}`
    })
      .catch({ statusCode: 500 }, ServerError.internal)
      .catch({ statusCode: 401 }, ServerError.unauthorized);
  }

  logs({ lastId }) {
    return this.authorizedRequest({
      uri: `${this.api_url}/logs`,
      qs: { last_id: lastId }
    })
      .catch({ statusCode: 500 }, ServerError.internal)
      .catch({ statusCode: 401 }, ServerError.unauthorized);
  }

  graph(body) {
    return this.authorizedRequest
      .post({
        uri: `${this.url}/api/graph`,
        body: body
      })
      .catch({ statusCode: 500 }, ServerError.internal)
      .catch({ statusCode: 401 }, ServerError.unauthorized);
  }

  generateMigration(formData) {
    return this.authorizedRequest
      .post({
        url: `${this.api_url}/migrations`,
        formData: formData
      })
      .catch({ statusCode: 500 }, ServerError.internal)
      .catch({ statusCode: 401 }, ServerError.unauthorized);
  }

  runMigration(formData) {
    return this.authorizedRequest
      .post({
        url: `${this.api_url}/migrations/run`,
        formData: formData
      })
      .catch({ statusCode: 500 }, ServerError.internal)
      .catch({ statusCode: 401 }, ServerError.unauthorized);
  }

  sync(formData) {
    return this.authorizedRequest
      .put({
        uri: `${this.api_url}/marketplace_releases/sync`,
        formData: formData
      })
      .catch({ statusCode: 500 }, ServerError.internal)
      .catch({ statusCode: 401 }, ServerError.unauthorized);
  }

  push(formData) {
    return this.authorizedRequest
      .post({
        uri: `${this.api_url}/marketplace_releases`,
        formData: formData
      })
      .catch({ statusCode: 500 }, ServerError.internal)
      .catch({ statusCode: 401 }, ServerError.unauthorized);
  }
}

module.exports = Gateway;
