const fs = require('fs'),
  url = require('url'),
  request = require('request-promise'),
  mime = require('mime');

const Portal = require('./portal');

const presignUrl = (s3FileName, fileName) => {
  const serviceUrl = `${process.env.DEPLOY_SERVICE_URL || process.env.MARKETPLACE_URL}/api/private/urls/presign-url`;
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
        marketplace_domain: url.parse(process.env.MARKETPLACE_URL).hostname,
        marketplace_endpoint: Portal.HOST
      },
      qs: params,
      json: true
    })
    .then(body => {
      return { uploadUrl: body.url, accessUrl: url.parse(body.accessUrl).href };
    });
};

module.exports = presignUrl;
