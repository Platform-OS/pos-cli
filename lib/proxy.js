const request = require('request');
const version = require('../package.json').version;
const logger = require('./kit.js').logger;

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
    return new Promise((resolve, reject) => {
      request(
        {
          uri: this.url + 'api/marketplace_builder/logs',
          method: 'GET',
          headers: this.headers
        },
        (error, response, body) => {
          if (error) reject({ status: error });
          else if (response.statusCode != 200)
            reject({
              status: response.statusCode,
              message: response.statusMessage
            });
          else resolve('OK');
        }
      );
    });
  }

  getStatus(id) {
    return new Promise((resolve, reject) => {
      request(
        {
          uri: this.url + 'api/marketplace_builder/marketplace_releases/' + id,
          method: 'GET',
          headers: this.headers
        },
        (error, response, body) => {
          if (error || response.statusCode != 200) reject(error || response.statusMessage);
          else resolve(JSON.parse(body));
        }
      );
    });
  }

  logs({ lastId }) {
    return new Promise((resolve, reject) => {
      request(
        {
          uri: this.url + 'api/marketplace_builder/logs',
          qs: { last_id: lastId },
          method: 'GET',
          headers: this.headers
        },
        (error, response, body) => {
          if (error) reject({ status: error });
          else if (response.statusCode != 200)
            reject({
              status: response.statusCode,
              message: response.statusMessage,
              body: body
            });
          else resolve(JSON.parse(body));
        }
      );
    });
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
          if (error)
            return reject(error);

          let json = JSON.parse(body);

          if (json.error)
            reject(body);
          else
            resolve(json);
        }
      );
    });
  }

  push(formData) {
    return new Promise((resolve, reject) => {
      logger.Debug('POST headers:');
      logger.Debug(this.headers);

      request(
        {
          uri: this.url + 'api/marketplace_builder/marketplace_releases',
          method: 'POST',
          headers: this.headers,
          formData: formData
        },
        (error, resp, body) => {
          if (error || resp.statusCode != 200) reject(error || body);
          else {
            resolve(body);
          }
        }
      );
    });
  }
}

module.exports = Gateway;
