const uuidv4 = require('uuid/v4'),
  path = require('path'),
  mapLimit = require('async/mapLimit'),
  logger = require('./../logger'),
  presignUrl = require('./../presignUrl'),
  uploadFile = require('./../s3UploadFile');

const filenameForUrl = uri => {
  return path.basename(uri);
};

const askForSlot = (tmpFileName, filename) => {
  logger.Debug('askForSlot');
  const s3FileName = `uploads/${uuidv4()}/${filename}`;

  return presignUrl(s3FileName, tmpFileName);
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
  if (data.transactables) data.transactables = await processFilesFor(data.transactables);
  if (data.models) data.models = await processFilesFor(data.models);
  if (data.users) data.users = await processFilesForUsers(data.users);

  logger.Debug('processData');
  return data;
}

const transform = data => {
  return processData(data);
};

module.exports = transform;
