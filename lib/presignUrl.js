import fs from 'fs';
import mime from 'mime';
import logger from './logger.js';
import Portal from './portal.js';

/**
 * Which instance to ask, and what proves the caller may ask it. From the argument when there is
 * one, and from `MARKETPLACE_*` otherwise, which is how the CLI supplies it. Concurrent callers
 * must pass it: those variables are process-wide, so one call can clear them under another.
 */
const presignAuth = (auth) => ({
  url: auth?.url ?? process.env.MARKETPLACE_URL,
  token: auth?.token ?? process.env.MARKETPLACE_TOKEN
});

const deployServiceUrl = (url) => process.env.DEPLOY_SERVICE_URL || new URL('/api/private/urls', url).href;

const presignHeaders = ({ url, token }) => ({ token, marketplace_domain: new URL(url).hostname });

const presignUrl = async (s3FileName, fileName, auth) => {
  const credentials = presignAuth(auth);
  const serviceUrl = `${deployServiceUrl(credentials.url)}/presign-url`;
  const params = new URLSearchParams({
    fileName: s3FileName,
    contentLength: fs.statSync(fileName)['size'].toString(),
    contentType: mime.getType(fileName)
  });

  const response = await fetch(`${serviceUrl}?${params}`, {
    method: 'GET',
    headers: presignHeaders(credentials)
  });

  if (!response.ok) {
    const error = new Error(`presignUrl failed with status ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const body = await response.json();
  return { uploadUrl: body.url, accessUrl: new URL(body.accessUrl).href };
};

const presignDirectory = async (path, auth) => {
  const credentials = presignAuth(auth);
  const serviceUrl = `${deployServiceUrl(credentials.url)}/presign-directory`;
  const params = new URLSearchParams({ directory: path });

  const response = await fetch(`${serviceUrl}?${params}`, {
    method: 'GET',
    headers: presignHeaders(credentials)
  });

  if (!response.ok) {
    const error = new Error(`presignDirectory failed with status ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return response.json();
};

const presignUrlForPortal = async (token, moduleName, _filename) => {
  const serviceUrl = `${Portal.url()}/api/pos_modules/${moduleName}/presign_url`;
  logger.Debug(token);

  const response = await fetch(serviceUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = new Error(`presignUrlForPortal failed with status ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const body = await response.json();
  return { uploadUrl: body.upload_url, accessUrl: body.access_url };
};

// An instance with no object storage configured cannot presign anything and says so with
// 501 instead of handing out a policy. Its assets travel through the instance itself
// instead — inside the release archive for `deploy`, and through the sync endpoint for
// `sync`. Only that one answer means "somewhere else": a 401, a 403 or a dropped
// connection says nothing about where assets belong and is left for the caller to report.
//
// One predicate, because deploy and sync have to agree about which answer is a routing
// decision and which is a failure.
const isDirectUploadUnavailable = error => error?.statusCode === 501;

export { isDirectUploadUnavailable, presignDirectory, presignUrl, presignUrlForPortal };
