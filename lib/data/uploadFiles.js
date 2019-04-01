const fs = require('fs'),
  request = require('request'),
  url = require('url'),
  uuidv4 = require('uuid/v4'),
  mime = require('mime'),
  path = require('path'),
  mapLimit = require('async/mapLimit'),
  logger = require('./../logger'),
  uploadFile = require('./../s3UploadFile');

const filenameForUrl = uri => {
  return path.basename(uri);
};

const askForSlot = (tmpFileName, filename) => {
  logger.Debug('askForSlot');
  const s3FileName = `uploads/${uuidv4()}/${filename}`;
  const params = { fileName: s3FileName, contentLength: fs.statSync(tmpFileName)['size'], contentType: mime.getType(tmpFileName) };
  return new Promise((resolve, reject) => {
    request.get(
      {
        url: `${process.env.DEPLOY_SERVICE_URL || process.env.MARKETPLACE_URL}/api/private/urls/presign-url`,
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
          reject(err || body || res.statusCode);
        } else {
          resolve({ uploadUrl: body.url, accessUrl: url.parse(body.accessUrl).href });
        }
      }
    );
  });
};

const updateItem = (item, newUrl) => {
  return Object.assign(item, { url: newUrl });
};

const uploadFiles = async(items) => {
  try {
    const result = [];
    for(const item of items) {
      const tick = new Date();
      const filename = filenameForUrl(item.url);
      const data = await askForSlot(item.url, filename);
      const newUrl = await uploadFile(item.url, data.uploadUrl);

      result.push(updateItem(item, data.accessUrl));
    }
    return result;
  } catch(e) {
    logger.Warn(e);
  }
};

const processModel = async(model) => {
  const fields = ['attachments', 'images'];
  for (let field of fields) {
    const items = (model[field] || [])
      .filter(item => item != null && !!item.url);

    model[field] = await uploadFiles(items);
  }

  logger.Debug('processModel');
  return model;
};

const processUser = async(user) => {
  user['profiles'] = await processFilesFor(user.profiles);
  return user;
};

CONCURRENCY = 4;
const processFilesFor = (collection) => {
  let i = 0;
  return new Promise((resolve, reject) => {
    mapLimit(collection, CONCURRENCY, async (item) => {
      i++;
      logger.Debug(i);
      return await processModel(item);
    }, (err, results) => {
      if (err) throw err;
      return resolve(results);
    });
  });
};

const processFilesForUsers = async(collection) => {
  const result = [];
  for (const item of collection) {
    result.push(await processUser(item));
  }
  return result;
};

async function processData(data) {
  data.transactables = await processFilesFor(data.transactables);
  data.models = await processFilesFor(data.models);
  data.users = await processFilesForUsers(data.users);

  logger.Debug('processData');
  return data;
}

const transform = data => {
  return processData(data);
};

module.exports = transform;
