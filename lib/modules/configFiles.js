import files from '../files.js';
import fs from 'fs';
import path from 'path';

const posConfigDirectory = 'app';
const posModulesFilePath = `${posConfigDirectory}/pos-modules.json`;
const posModulesLockFilePath = `${posConfigDirectory}/pos-modules.lock.json`;

const readLocalModules = () => {
  const config = files.readJSON(posModulesFilePath, { throwDoesNotExistError: false });
  return config['modules'] || {};
};

const writePosModules = (modules) => {
  fs.writeFileSync(
    path.join(process.cwd(), posModulesFilePath),
    JSON.stringify({ modules: modules }, null, 2)
  );
};

const writePosModulesLock = (modules) => {
  fs.writeFileSync(
    path.join(process.cwd(), posModulesLockFilePath),
    JSON.stringify({ modules: modules }, null, 2)
  );
};

export { posModulesFilePath, posModulesLockFilePath, readLocalModules, writePosModules, writePosModulesLock, posConfigDirectory };
