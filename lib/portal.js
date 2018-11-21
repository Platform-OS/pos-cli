const request = require('request-promise'),
  logger = require('./logger');

const Portal = {
  authorizeDeploy: (email, password) => {
    logger.Debug('Portal.authorizeDeploy ' + email + ' to ' + PARTNER_PORTAL_HOST);

    return request({
      url: `${PARTNER_PORTAL_HOST}/api/user_tokens`,
      headers: { UserAuthorization: `${email}:${password}` },
      json: true
    });
  },

  authenticate: (email, password) => {
    logger.Debug('Portal.authenticate ' + email + ' to ' + PARTNER_PORTAL_HOST);

    return request({
      method: 'POST',
      url: `${PARTNER_PORTAL_HOST}/api/authenticate`,
      body: {
        email: email,
        password: password
      },
      json: true
    });
  },

  findInstance: (url, token) => {
    logger.Debug('Portal.findInstance ' + url + ' to ' + PARTNER_PORTAL_HOST);

    return request({
      url: `${PARTNER_PORTAL_HOST}/api/instances/search?domain=${url}`,
      headers: { Authorization: `Bearer ${token}` },
      json: true
    });
  }
};

module.exports = Portal;
