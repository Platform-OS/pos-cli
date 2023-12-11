const fs = require('fs');
const unzipper = require('unzipper');

function unzip(filePath, outputFilePath) {
  fs.createReadStream(filePath)
    .pipe(unzipper.Extract({ path: outputFilePath }));
}

module.exports = {
  uznzip: unzip
};
