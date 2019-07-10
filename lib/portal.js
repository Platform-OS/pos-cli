const request = require('request-promise'),
  logger = require('./logger');

const HOST = process.env.PARTNER_PORTAL_HOST || 'https://partners.platform-os.com';

const Portal = {
  login: (email, password) => {
    logger.Debug('Portal.login ' + email + ' to ' + HOST);

    return request({
      url: `${HOST}/api/user_tokens`,
      headers: { UserAuthorization: `${email}:${password}` },
      json: true
    });
  },
  HOST: HOST
};

module.exports = Portal;
