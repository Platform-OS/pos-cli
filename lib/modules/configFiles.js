const files = require('../files');
const fs = require('fs');
const path = require('path');

const posModulesFilePath = 'app/pos-modules.json';
const posModulesLockFilePath = 'app/pos-modules.lock.json';

const readLocalModules = () => {
  const config = files.readJSON(posModulesFilePath, { throwDoesNotExistError: true });
  return config['modules'] || {};
};

const writePosModules = (modules) => {
  fs.writeFileSync(
    path.join(process.cwd(), posModulesFilePath),
    JSON.stringify({ modules: modules }, null, 2)
  );
}

const writePosModulesLock = (modules) => {
  fs.writeFileSync(
    path.join(process.cwd(), posModulesLockFilePath),
    JSON.stringify({ modules: modules }, null, 2)
  );
}

module.exports = {
  posModulesFilePath: posModulesFilePath,
  posModulesLockFilePath: posModulesLockFilePath,
  readLocalModules: readLocalModules,
  writePosModules: writePosModules,
  writePosModulesLock: writePosModulesLock
}
