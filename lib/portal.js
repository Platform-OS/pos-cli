const request = require('request-promise'),
  logger = require('./kit').logger;

const Portal = {
  login: (email, password) => {
    logger.Debug('Portal.login ' + email + ' to ' + PARTNER_PORTAL_HOST);

    return request({
      url: `${PARTNER_PORTAL_HOST}/api/user_tokens`,
      headers: { UserAuthorization: `${email}:${password}` },
      json: true
    });
  }
};

module.exports = Portal;
