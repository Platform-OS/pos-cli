import fs from 'fs';
import path from 'path';
const overwritesPath = path.join(process.cwd(), 'app/modules');
const prefixToRemove = path.join(process.cwd(), 'app');
import logger from '../lib/logger.js';

function getOverwrites(dir, baseDir = dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  items.forEach(item => {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...getOverwrites(fullPath, baseDir));
    } else {
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

export default Overwrites;
