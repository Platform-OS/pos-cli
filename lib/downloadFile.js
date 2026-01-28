import fs from 'fs';
import https from 'https';
import http from 'http';

const downloadFile = (url, fileName) => {
  return new Promise((resolve, reject) => {
    let file = fs.createWriteStream(fileName).on('close', () => resolve());
    const request = url.startsWith('https') ? https : http;
    request.get(url, response => {
      response.pipe(file);
      file
        .on('finish', () => {
          file.close(resolve);
        })
        .on('error', reject);
    });
  });
};

export default downloadFile;
