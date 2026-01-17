import fs from 'fs';
import unzipper from 'unzipper';

async function unzip(filePath, outputFilePath) {
  return unzipper.Open.file(filePath)
    .then(d => d.extract({ path: outputFilePath }));
}

export { unzip };
