import { apiRequest } from './apiRequest.js';
import logger from './logger.js';

const Portal = {
  url: () => { return process.env.PARTNER_PORTAL_HOST || 'https://partners.platformos.com' },

  login: (email, password, url) => {
    logger.Debug('Portal.login ' + email + ' to ' + Portal.url());

    return apiRequest({
      uri: `${Portal.url()}/api/user_tokens`,
      headers: { UserAuthorization: `${email}:${password}`, InstanceDomain: url },
    });
  },
  jwtToken: (email, password) => {
    return apiRequest({
      method: 'POST',
      uri: `${Portal.url()}/api/authenticate`,
      formData: { email: email, password: password },
    });
  },
  findModules: (token, name) => {
    return apiRequest({
      method: 'GET',
      uri: `${Portal.url()}/api/pos_modules/?modules=${name}`,
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  moduleVersions(modules) {
    return apiRequest({
      uri: `${Portal.url()}/api/pos_modules?modules=${modules.join(',')}`,
    });
  },
  createVersion: (token, url, name, posModuleId) => {
    return apiRequest({
      method: 'POST',
      uri: `${Portal.url()}/api/pos_modules/${posModuleId}/pos_module_versions`,
      body: { pos_module_version: { archive: url, name: name } },
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  moduleVersionStatus: (token, posModuleId, moduleVersionId) => {
    return apiRequest({
      method: 'GET',
      uri: `${Portal.url()}/api/pos_modules/${posModuleId}/pos_module_versions/${moduleVersionId}`,
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  moduleVersionsSearch: (moduleVersionName) => {
    return apiRequest({
      method: 'GET',
      uri: `${Portal.url()}/api/pos_module_version?name=${moduleVersionName}`
    });
  },
  requestDeviceAuthorization: (instanceDomain) => {
    return apiRequest({
      method: 'POST',
      uri: `${Portal.url()}/oauth/authorize_device`,
      formData: {
        domain: instanceDomain
      },
      json: true
    });
  },
  fetchDeviceAccessToken: (deviceCode) => {
    return apiRequest({
      method: 'POST',
      uri: `${Portal.url()}/oauth/device_token`,
      formData: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode
      },
      json: true
    });
  }
};

export default Portal;
