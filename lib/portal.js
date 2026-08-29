import { apiRequest } from './apiRequest.js';
import logger from './logger.js';

const Portal = {
  url: () => {
    return process.env.PARTNER_PORTAL_HOST || 'https://partners.platformos.com'; 
  },

  // otpCode travels in its own header rather than as a third colon-delimited field of
  // UserAuthorization: a password may contain a colon, and there would be no telling which
  // segment was which. The portal reads it as Api::UserTokensController::OTP_CODE_HEADER.
  login: (email, password, url, otpCode) => {
    logger.Debug('Portal.login ' + email + ' to ' + Portal.url());

    const headers = { UserAuthorization: `${email}:${password}`, InstanceDomain: url };
    if (otpCode) headers.UserOtpCode = otpCode;

    return apiRequest({
      uri: `${Portal.url()}/api/user_tokens`,
      headers
    });
  },
  jwtToken: (email, password, otpCode) => {
    const formData = { email: email, password: password };
    if (otpCode) formData.otp_code = otpCode;

    return apiRequest({
      method: 'POST',
      uri: `${Portal.url()}/api/authenticate`,
      formData
    });
  },
  // What the Portal knows about a token, including whether its holder must prove a second
  // factor before deploying and whether they already have. The Instance asks the same
  // question of the same endpoint when it validates the token (see its
  // Api::OAuth::RequestAuthorization), so both sides read one verdict.
  tokenInfo: ({ portalUrl, token }) => {
    const base = (portalUrl || Portal.url()).replace(/\/+$/, '');

    return apiRequest({
      method: 'GET',
      uri: `${base}/oauth/token/info`,
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  // Exchanges a credential the caller already holds for a short-lived two-factor session
  // an Instance will accept for a deploy. Deliberately a Portal call and not an Instance
  // one: Instances run tenant-authored code, so a code that travelled through one could be
  // harvested and replayed inside the thirty seconds it stays valid.
  twoFactorSession: ({ portalUrl, token, instanceDomain, otpCode }) => {
    const base = (portalUrl || Portal.url()).replace(/\/+$/, '');
    logger.Debug(`[Portal.twoFactorSession] Requesting a session from ${base} for ${instanceDomain}`);

    return apiRequest({
      method: 'POST',
      uri: `${base}/api/two_factor_session`,
      headers: { Authorization: `Bearer ${token}` },
      body: { instance_domain: instanceDomain, otp_code: otpCode || undefined }
    });
  },
  findModules: (token, name) => {
    return apiRequest({
      method: 'GET',
      uri: `${Portal.url()}/api/pos_modules/?modules=${name}`,
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  moduleVersions(modules, registryUrl) {
    const base = registryUrl || Portal.url();
    return apiRequest({
      uri: `${base}/api/pos_modules?modules=${modules.join(',')}`
    });
  },
  createVersion: (token, url, name, posModuleId) => {
    return apiRequest({
      method: 'POST',
      uri: `${Portal.url()}/api/pos_modules/${posModuleId}/pos_module_versions`,
      body: { pos_module_version: { archive: url, name: name } },
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  moduleVersionStatus: (token, posModuleId, moduleVersionId) => {
    return apiRequest({
      method: 'GET',
      uri: `${Portal.url()}/api/pos_modules/${posModuleId}/pos_module_versions/${moduleVersionId}`,
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  moduleVersionsSearch: (moduleVersionName, registryUrl) => {
    const base = registryUrl || Portal.url();
    return apiRequest({
      method: 'GET',
      uri: `${base}/api/pos_module_version?name=${moduleVersionName}`
    });
  },
  requestDeviceAuthorization: (instanceDomain) => {
    logger.Debug(`[Portal.requestDeviceAuthorization] Sending request to ${Portal.url()}/oauth/authorize_device`);
    logger.Debug(`[Portal.requestDeviceAuthorization] Instance domain: ${instanceDomain}`);
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
    logger.Debug(`[Portal.fetchDeviceAccessToken] Fetching access token from ${Portal.url()}/oauth/device_token`);
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
