const fs = require('fs'),
  request = require('request'),
  url = require('url'),
  path = require('path'),
  shell = require('shelljs');

const download = (uri, filename) => {
  return new Promise((resolve, reject) => {
    request.head(uri, (err, res, body) => {
      if (err) {
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

async function fetchFiles(model) {
  const fields = ['attachments', 'images'];
  for (let itemsField of fields) {
    const items = await Promise.all(
      (model[itemsField] || []).filter(item => !!item.url).map(item => {
        const filename = filenameForUrl(item.url);
        const dir = `tmp/${itemsField}/${item.id}`;
        const tmpFilename = `${dir}/${filename}`;
        shell.mkdir('-p', dir);

        return download(item.url, tmpFilename).then(newUrl =>
          updateItem(item, newUrl)
        );
      })
    );
    model[itemsField] = items;
  }
  return model;
}

module.exports = fetchFiles;
