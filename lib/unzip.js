const fs = require('fs');
const unzipper = require('unzipper');

async function unzip(filePath, outputFilePath) {
  return unzipper.Open.file(filePath)
    .then(d => d.extract({ path: outputFilePath }));
}

module.exports = {
  unzip: unzip
};
