const fs = require('fs'),
      axios = require('axios'),
      mime = require('mime'),
      logger = require('./logger'),
      Portal = require('./portal');

const deployServiceUrl = () => {
  if (process.env.DEPLOY_SERVICE_URL) {
    return process.env.DEPLOY_SERVICE_URL;
  }
  const baseUrl = new URL(process.env.MARKETPLACE_URL);
  return new URL('/api/private/urls', baseUrl).href;
};

const presignUrl = async (s3FileName, fileName) => {
  const serviceUrl = `${deployServiceUrl()}/presign-url`;
  const params = {
    fileName: s3FileName,
    contentLength: fs.statSync(fileName)['size'],
    contentType: mime.getType(fileName)
  };

  const marketplaceUrl = new URL(process.env.MARKETPLACE_URL);
  const response = await axios.get(serviceUrl, {
    headers: {
      token: process.env.MARKETPLACE_TOKEN,
      marketplace_domain: marketplaceUrl.hostname
    },
    params: params
  });

  const accessUrl = new URL(response.data.accessUrl);
  return { uploadUrl: response.data.url, accessUrl: accessUrl.href };
};

const presignDirectory = async path => {
  const serviceUrl = `${deployServiceUrl()}/presign-directory`;
  const params = { directory: path };

  const marketplaceUrl = new URL(process.env.MARKETPLACE_URL);
  const response = await axios.get(serviceUrl, {
    headers: {
      token: process.env.MARKETPLACE_TOKEN,
      marketplace_domain: marketplaceUrl.hostname
    },
    params: params
  });

  return response.data;
};

const presignUrlForPortal = async (token, moduleName, filename) => {
  const serviceUrl = `${Portal.url()}/api/pos_modules/${moduleName}/presign_url`;
  logger.Debug(token);

  const response = await axios.get(serviceUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return { uploadUrl: response.data.upload_url, accessUrl: response.data.access_url };
};

module.exports = {
  presignDirectory: presignDirectory,
  presignUrl: presignUrl,
  presignUrlForPortal: presignUrlForPortal
};
