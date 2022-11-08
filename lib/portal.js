const request = require('request-promise'),
  logger = require('./logger');

const HOST = process.env.PARTNER_PORTAL_HOST || 'https://partners.platformos.com';

const Portal = {
  login: (email, password, url) => {
    logger.Debug('Portal.login ' + email + ' to ' + HOST);

    return request({
      url: `${HOST}/api/user_tokens`,
      headers: { UserAuthorization: `${email}:${password}`, InstanceDomain: url },
      json: true
    });
  },
  jwt_token: (email, password) => {
    return request({
      method: 'POST',
      url: `${HOST}/api/authenticate`,
      formData: { email: email, password: password },
      json: true
    });
  },
  HOST: HOST
};

module.exports = Portal;
