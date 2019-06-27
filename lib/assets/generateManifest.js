const fs = require('fs'),
  glob = require('glob');
const APP_DIR = 'app';
const LEGACY_APP_DIR = 'marketplace_builder';
const MODULES_DIR = 'modules';
const appDirectory = fs.existsSync(APP_DIR) ? APP_DIR : LEGACY_APP_DIR;

const serializerManifestEntry = (file) => {
  const fileUpdatedAt = Math.floor(new Date(fs.statSync(file)['mtime']) / 1000);
  return { physical_file_path: file.replace(new RegExp(`^${appDirectory}/`), ''), updated_at: fileUpdatedAt };
};

const generateManifest = () => {
  let manifest = {};
  const files = glob.sync(`${appDirectory}/assets/**/*`, { nodir: true });
  for (const file of files) {
    const path = file.replace(new RegExp(`(public|private)\/assets\/|(${appDirectory})\/assets\/`), '');
    manifest[path] = serializerManifestEntry(file);
  }

  const modulesFiles = glob.sync('modules/*/?(public|private)/assets/**', { nodir: true });
  for (let file of modulesFiles) {
    const path = file.replace(new RegExp(`(public|private)\/assets\/|(${appDirectory})\/assets\/`), '');
    manifest[path] = serializerManifestEntry(file);
  }
  return manifest;
};

module.exports = generateManifest;
