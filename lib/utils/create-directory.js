const fs = require('fs');
const rl = require('readline');
const logger = require('../logger');

const createDirectory = (directory) => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(directory)) {
      resolve(true);
    } else {
      const reader = rl.createInterface({ input: process.stdin, output: process.stdout });
      reader.stdoutMuted = true;
      reader.question(`The directory ${directory} does not exist. Do you want to create it? (y/n):`, answer => {
        if (answer.toLowerCase() === 'y') {
          fs.mkdirSync(directory, { recursive: true });
          reader.close();
          resolve(true);
        } else {
          reader.close();
          reject(false)
        }
      });
    }
  });
};

module.exports = {
  createDirectory: createDirectory
};
