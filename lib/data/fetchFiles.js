const fs = require('fs'),
  request = require('request'),
  url = require('url'),
  path = require('path'),
  shell = require('shelljs'),
  flatten = require('array-flatten'),
  Queue = require('async/queue'),
  logger = require('./../logger');

const download = (uri, filename) => {
  return new Promise((resolve, reject) => {
    request.head(uri, (err, res, body) => {
      if (err) {
        logger.Warn(err);
        reject(err);
      } else {
        request(uri)
          .pipe(fs.createWriteStream(filename))
          .on('close', () => resolve(filename));
      }
    });
  });
};

const filenameForUrl = uri => {
  return path.basename(url.parse(uri).pathname);
};

const updateItem = (item, newUrl) => {
  return { url: newUrl, name: item.name };
};

const filterItemsFromModel = (model, field) => {
  return (model[field] || []).filter(item => !!item.url);
};

const tmpFileMeta = (item, field) => {
  const filename = filenameForUrl(item.url);
  const dir = `tmp/${field}/${item.id}`;
  const tmpFilename = `${dir}/${filename}`;

  return { filename: tmpFilename, dir: dir };
};

CONCURRENCY = 12;

const queue = Queue((task, callback) => {
  download(task.url, task.tmpFilename).then(callback);
}, CONCURRENCY);

const enqueue = item => {
  queue.push(item, () => {});
};

const addTmpFilename = (item) => {
  const tmpFile = tmpFileMeta(item, item.field);
  shell.mkdir('-p', tmpFile.dir);

  item.tmpFilename = tmpFile.filename;
  return item;
};

const downloadFiles = (collection) => {
  collection
    .map(addTmpFilename)
    .map(enqueue);
};

async function fetchFiles(model) {
  const fields = ['attachments', 'images'];
  const filesForDownload = flatten(
    fields.map(field => {
      return filterItemsFromModel(model, field)
        .map(item => {
          return { url: item.url, id: item.id, field: field };
        });
    })
  );
  downloadFiles(filesForDownload);

  for (let field of fields) {
    const items = filterItemsFromModel(model,field)
      .map(item => {
        return { url: item.url, id: item.id, field: field };
      })
      .map(item => {
        return updateItem(item, addTmpFilename(item).tmpFilename);
      });
    console.log(items.length);
    model[field] = items;
  }
  return model;
}

module.exports = fetchFiles;
