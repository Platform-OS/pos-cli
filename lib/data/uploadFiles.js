const fs = require('fs'),
  request = require('request'),
  url = require('url'),
  uuidv4 = require('uuid/v4'),
  mime = require('mime'),
  path = require('path'),
  uploadFile = require('./../s3UploadFile');

const filenameForUrl = uri => {
  return path.basename(url.parse(uri).pathname);
};

const askForSlot = (tmpFileName, filename) => {
  const s3FileName = `uploads/${uuidv4()}/${filename}`;
  const params = { fileName: s3FileName, contentLength: fs.statSync(tmpFileName)['size'], contentType: mime.getType(tmpFileName) };
  return new Promise((resolve, reject) => {
    request.get(
      {
        url: `${process.env.MARKETPLACE_URL}/api/private/urls/presign-url`,
        headers: {
          token: process.env.MARKETPLACE_TOKEN,
          marketplace_domain: url.parse(process.env.MARKETPLACE_URL).hostname,
          marketplace_endpoint: PARTNER_PORTAL_HOST
        },
        qs: params,
        json: true
      },
      (err, res, body) => {
        if (err || res.statusCode != 200) {
          reject(err || body);
        } else {
          resolve({ uploadUrl: body.url, accessUrl: body.accessUrl });
        }
      }
    );
  });
};

const updateItem = (item, newUrl) => {
  return Object.assign(item, { url: newUrl });
};

async function processModel(model) {
  const fields = ['attachments', 'images'];
  for (let itemsField of fields) {
    const items = await Promise.all(
      (model[itemsField] || [])
        .filter(item => !!item.url)
        .map(item => {
          const filename = filenameForUrl(item.url);
          const tmpFilename = item.url;
          return askForSlot(item.url, filename)
            .then(data => {
              return new Promise((resolve, reject) => {
                console.log(data);
                uploadFile(tmpFilename, data.uploadUrl).then(uploadUrl => resolve(data.accessUrl));
              });
            })
            .then(newUrl => updateItem(item, newUrl));
        }));
    model[itemsField] = items;
  }
  return model;
}

async function processData(data) {
  // data.users = await Promise.all(users.map(model => processModel(model, 'custom_attachments')));
  data.transactables = await Promise.all(
    data.transactables.map(model => processModel(model))
  );
  data.models = await Promise.all(
    data.models.map(model => processModel(model))
  );
  return data;
}

const transform = data => {
  return processData(data);
};

module.exports = transform;
