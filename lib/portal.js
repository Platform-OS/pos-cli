const apiRequest = require('./apiRequest');
const logger = require('./logger');

const HOST = process.env.PARTNER_PORTAL_HOST || 'https://partners.platformos.com';

const Portal = {
  login: (email, password, url) => {
    logger.Debug('Portal.login ' + email + ' to ' + HOST);

    return apiRequest({
      uri: `${HOST}/api/user_tokens`,
      headers: { UserAuthorization: `${email}:${password}`, InstanceDomain: url },
      json: true
    });
  },
  jwtToken: (email, password) => {
    return apiRequest({
      method: 'POST',
      uri: `${HOST}/api/authenticate`,
      formData: { email: email, password: password },
      json: true
    });
  },
  findModules: (token, name) => {
    return apiRequest({
      method: 'GET',
      uri: `${HOST}/api/pos_modules/?modules=${name}`,
      headers: { Authorization: `Bearer ${token}` },
      json: true
    });
  },
  createVersion: (token, url, name, posModuleId) => {
    return apiRequest({
      method: 'POST',
      uri: `${HOST}/api/pos_modules/${posModuleId}/pos_module_versions`,
      body: { pos_module_version: { archive: url, name: name } },
      headers: { Authorization: `Bearer ${token}` },
      json: true
    });
  },
  moduleVersionStatus: (token, posModuleId, moduleVersionId) => {
    return apiRequest({
      method: 'GET',
      uri: `${HOST}/api/pos_modules/${posModuleId}/pos_module_versions/${moduleVersionId}`,
      headers: { Authorization: `Bearer ${token}` },
      json: true
    });
  },
  HOST: HOST
};

module.exports = Portal;
