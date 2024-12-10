const fs = require('fs');
const path = require('path');
const overwritesPath = path.join(process.cwd(), 'app/modules');
const prefixToRemove = path.join(process.cwd(), 'app');
const logger = require('../lib/logger');

function getOverwrites(dir, baseDir = dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  items.forEach(item => {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...getOverwrites(fullPath, baseDir));
    } else {
      // Create the relative path based on baseDir and remove the 'app/' prefix
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push(relativePath);
    }
  });

  return files;
}


const Overwrites = {
  list: (moduleName) => {
    let moduleOverwritesPath = overwritesPath;
    if(moduleName) {
      logger.Info(moduleName)
       moduleOverwritesPath = path.join(overwritesPath, moduleName);
    }

    return getOverwrites(moduleOverwritesPath, prefixToRemove);
  }
}

module.exports = Overwrites;
