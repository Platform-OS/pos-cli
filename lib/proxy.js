const request = require('request-promise'),
  version = require('../package.json').version,
  logger = require('./kit').logger;

const logHttpError = error => logger.Error(`[${error.statusCode}] ${error.error}`, { hideTimestamp: true });

class Gateway {
  constructor({ url, token, email }) {
    this.url = url;
    this.token = token;
    this.email = email;
  }

  get headers() {
    return {
      Authorization: `Token ${this.token}`,
      'User-Agent': `marketplace-kit/${version}`,
      From: this.email
    };
  }

  ping() {
    return request({
      uri: `${this.url}api/marketplace_builder/logs`,
      headers: this.headers
    }).catch(logHttpError);
  }

  getStatus(id) {
    return request({
      uri: `${this.url}api/marketplace_builder/marketplace_releases/${id}`,
      headers: this.headers,
      json: true
    });
  }

  logs({ lastId }) {
    return request({
      uri: `${this.url}api/marketplace_builder/logs`,
      qs: { last_id: lastId },
      headers: this.headers,
      json: true
    }).catch(logHttpError);
  }

  graph(body) {
    return new Promise((resolve, reject) => {
      request(
        {
          uri: `${this.url}/api/graph`,
          method: 'POST',
          headers: this.headers,
          json: body
        },
        (error, resp, body) => {
          if (body) resolve(body);
          else {
            reject(body);
          }
        }
      );
    });
  }

  generateMigration(formData) {
    logger.Info('Generating Migration');

    return new Promise((resolve, reject) => {
      request(
        {
          method: 'POST',
          url: this.url + 'api/marketplace_builder/migrations',
          headers: this.headers,
          json: true,
          formData: formData
        },
        (error, response, body) => {
          if (error) reject({ status: error });
          else if (response.statusCode != 200)
            reject({
              status: response.statusCode,
              message: response.statusMessage
            });
          else resolve(body);
        }
      );
    });
  }

  runMigration(formData) {
    logger.Info('Running Migration');

    return new Promise((resolve, reject) => {
      request(
        {
          method: 'POST',
          url: this.url + 'api/marketplace_builder/migrations/run',
          headers: this.headers,
          json: true,
          formData: formData
        },
        (error, response, body) => {
          if (error) reject({ status: error });
          else if (response.statusCode != 200)
            reject({
              status: response.statusCode,
              message: response.body.error
            });
          else resolve(body);
        }
      );
    });
  }

  sync(formData) {
    logger.Debug('SYNC headers:');
    logger.Debug(this.headers);

    return new Promise((resolve, reject) => {
      request(
        {
          uri: this.url + 'api/marketplace_builder/marketplace_releases/sync',
          method: 'PUT',
          headers: this.headers,
          formData: formData
        },
        (error, resp, body) => {
          if (error) return reject(error);

          let json = JSON.parse(body);

          if (json.error) reject(body);
          else resolve(json);
        }
      );
    });
  }

  push(formData) {
    logger.Debug('POST headers:', this.headers);

    return request
      .post({
        uri: `${this.url}api/marketplace_builder/marketplace_releases`,
        headers: this.headers,
        formData: formData,
        json: true
      })
      .catch(logHttpError);
  }
}

module.exports = Gateway;
