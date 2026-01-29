import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import flatten from 'lodash.flatten';
import async from 'async';
import logger from './../logger.js';
const CONCURRENCY = 12;

const download = async (uri, filename) => {
  try {
    const response = await fetch(uri, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`HEAD request failed with status ${response.status}`);
    }

    const downloadResponse = await fetch(uri);
    if (!downloadResponse.ok) {
      throw new Error(`Download failed with status ${downloadResponse.status}`);
    }

    const buffer = await downloadResponse.arrayBuffer();
    fs.writeFileSync(filename, Buffer.from(buffer));
    return filename;
  } catch (err) {
    logger.Warn(err);
    throw err;
  }
};

const filenameForUrl = uri => {
  return path.basename(new URL(uri).pathname);
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

const queue = async.queue((task, callback) => {
  download(task.url, task.tmpFilename).then(callback).catch(callback);
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
        return { url: item.url, id: item.id, field: field, name: item.name };
      })
      .map(item => {
        return updateItem(item, addTmpFilename(item).tmpFilename);
      });
    model[field] = items;
  }
  return model;
}

export default fetchFiles;
