const fs = require('fs'),
  request = require('request'),
  mime = require('mime');

const uploadFile = (fileName, s3Url) => {
  var stats = fs.statSync(fileName);
  return new Promise((resolve, reject) => {
    fs.createReadStream(fileName).pipe(
      request
        .put({
          url: s3Url,
          headers: {
            'Content-Length': stats['size']
          }
        })
        .on('error', e => reject(e))
        .on('response', response => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(s3Url);
          } else {
            reject(response.statusCode);
          }
        })
    );
  });
};

const uploadFileFormData = (filePath, data) => {
  const formData = {};
  Object.entries(data.fields).forEach(([k, v]) => {
    formData[k] = v;
  });
  formData['Content-Type'] = mime.getType(filePath);
  formData['file'] = fs.createReadStream(filePath);

  return new Promise((resolve, reject) => {
    request
      .post({
        url: data.url,
        formData: formData
      })
      .on('error', e => reject(e))
      .on('response', response => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(true);
        } else {
          reject(response.statusCode);
        }
      });
  });
};

module.exports = {
  uploadFile: uploadFile,
  uploadFileFormData: uploadFileFormData
};
