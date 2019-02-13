const fs = require('fs'),
  request = require('request'),
  mime = require('mime');

const uploadFile = (fileName, s3Url) => {
  var stats = fs.statSync(fileName);
  return new Promise((resolve, reject) => {
    fs.createReadStream(fileName).pipe(
      request
        .put({ url: s3Url, headers: { 'Content-Type': mime.getType(fileName), 'Content-Length': stats['size'] } })
        .on('error', e => reject(e))
        .on('end', () => resolve(s3Url))
    );
  });
};

module.exports = uploadFile;
