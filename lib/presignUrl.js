import fs from 'fs';
import url from 'url';
import mime from 'mime';
import logger from './logger.js';
import Portal from './portal.js';

const deployServiceUrl = () => process.env.DEPLOY_SERVICE_URL || url.resolve(process.env.MARKETPLACE_URL, '/api/private/urls');

const presignUrl = async (s3FileName, fileName) => {
  const serviceUrl = `${deployServiceUrl()}/presign-url`;
  const params = new URLSearchParams({
    fileName: s3FileName,
    contentLength: fs.statSync(fileName)['size'].toString(),
    contentType: mime.getType(fileName)
  });

  const response = await fetch(`${serviceUrl}?${params}`, {
    method: 'GET',
    headers: {
      token: process.env.MARKETPLACE_TOKEN,
      marketplace_domain: url.parse(process.env.MARKETPLACE_URL).hostname
    }
  });

  if (!response.ok) {
    const error = new Error(`presignUrl failed with status ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const body = await response.json();
  return { uploadUrl: body.url, accessUrl: url.parse(body.accessUrl).href };
};

const presignDirectory = async (path) => {
  const serviceUrl = `${deployServiceUrl()}/presign-directory`;
  const params = new URLSearchParams({ directory: path });

  const response = await fetch(`${serviceUrl}?${params}`, {
    method: 'GET',
    headers: {
      token: process.env.MARKETPLACE_TOKEN,
      marketplace_domain: url.parse(process.env.MARKETPLACE_URL).hostname
    }
  });

  if (!response.ok) {
    const error = new Error(`presignDirectory failed with status ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return response.json();
};

const presignUrlForPortal = async (token, moduleName, filename) => {
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

export { presignDirectory, presignUrl, presignUrlForPortal };
