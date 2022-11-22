const fs = require('fs'),
  url = require('url'),
  request = require('request-promise'),
  mime = require('mime');
const logger = require('./logger');

const Portal = require('./portal');
const deployServiceUrl = () => process.env.DEPLOY_SERVICE_URL || url.resolve(process.env.MARKETPLACE_URL, '/api/private/urls');

const presignUrl = (s3FileName, fileName) => {
  const serviceUrl = `${deployServiceUrl()}/presign-url`;
  const params = {
    fileName: s3FileName,
    contentLength: fs.statSync(fileName)['size'],
    contentType: mime.getType(fileName)
  };

  return request
    .get({
      url: serviceUrl,
      headers: {
        token: process.env.MARKETPLACE_TOKEN,
        marketplace_domain: url.parse(process.env.MARKETPLACE_URL).hostname
      },
      qs: params,
      json: true
    })
    .then(body => {
      return { uploadUrl: body.url, accessUrl: url.parse(body.accessUrl).href };
    });
};

const presignDirectory = path => {
  const serviceUrl = `${deployServiceUrl()}/presign-directory`;
  const params = { directory: path };

  return request
    .get({
      url: serviceUrl,
      headers: {
        token: process.env.MARKETPLACE_TOKEN,
        marketplace_domain: url.parse(process.env.MARKETPLACE_URL).hostname
      },
      qs: params,
      json: true
    })
    .then(body => body);
};

const presignUrlForPortal = (token, moduleName, filename) => {
  const HOST = process.env.PARTNER_PORTAL_HOST || 'https://partners.platformos.com';
  const serviceUrl = `${HOST}/api/pos_modules/${moduleName}/presign_url`;
  logger.Debug(token);
  return request
    .get({
      url: serviceUrl,
      headers: {
        Authorization: `Bearer ${token}`
      },
      json: true
    })
    .then(body => {
      console.log(body);
      return { uploadUrl: body.upload_url, accessUrl: body.access_url.replace('%24%7Bfilename%7D', filename) };
    });
};

module.exports = {
  presignDirectory: presignDirectory,
  presignUrl: presignUrl,
  presignUrlForPortal: presignUrlForPortal
};
