const { apiRequest } = require('./apiRequest');
const logger = require('./logger');

const HOST = process.env.PARTNER_PORTAL_HOST || 'https://partners.platformos.com';

const Portal = {
  login: (email, password, url) => {
    logger.Debug('Portal.login ' + email + ' to ' + HOST);

    return apiRequest({
      uri: `${HOST}/api/user_tokens`,
      headers: { UserAuthorization: `${email}:${password}`, InstanceDomain: url },
    });
  },
  jwtToken: (email, password) => {
    return apiRequest({
      method: 'POST',
      uri: `${HOST}/api/authenticate`,
      formData: { email: email, password: password },
    });
  },
  findModules: (token, name) => {
    return apiRequest({
      method: 'GET',
      uri: `${HOST}/api/pos_modules/?modules=${name}`,
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  moduleVersions(modules) {
    return apiRequest({
      uri: `${HOST}/api/pos_modules?modules=${modules.join(',')}`,
    });
  },
  createVersion: (token, url, name, posModuleId) => {
    return apiRequest({
      method: 'POST',
      uri: `${HOST}/api/pos_modules/${posModuleId}/pos_module_versions`,
      body: { pos_module_version: { archive: url, name: name } },
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  moduleVersionStatus: (token, posModuleId, moduleVersionId) => {
    return apiRequest({
      method: 'GET',
      uri: `${HOST}/api/pos_modules/${posModuleId}/pos_module_versions/${moduleVersionId}`,
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  requestDeviceAuthorization: (instanceDomain) => {
    return apiRequest({
      method: 'POST',
      uri: `${HOST}/oauth/authorize_device`,
      formData: {
        domain: instanceDomain
      },
      json: false
    });
  },
  fetchDeviceAccessToken: (deviceCode) => {
    return apiRequest({
      method: 'POST',
      uri: `${HOST}/oauth/device_token`,
      formData: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode
      },
      json: true
    });
  },

  HOST: HOST
};

module.exports = Portal;
