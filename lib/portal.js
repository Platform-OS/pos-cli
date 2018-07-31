const request = require('request');
const logger = require('./kit').logger;

const Portal = {
  login: (email, password) => {
    logger.Debug('Portal.login ' + email + ' to ' + PARTNER_PORTAL_HOST);
    return new Promise((resolve, reject) => {
      request(
        {
          uri: PARTNER_PORTAL_HOST + '/api/user_tokens',
          headers: { UserAuthorization: `${email}:${password}` },
          method: 'GET'
        },
        (error, response, body) => {
          if (error) reject({ status: error });
          else if (response.statusCode != 200)
            reject({
              status: response.statusCode,
              message: response.statusMessage
            });
          else resolve(JSON.parse(body));
        }
      );
    });
  }
};

module.exports = Portal;
