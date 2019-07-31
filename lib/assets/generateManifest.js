const fs = require('fs'),
  dir = require('../directories'),
  files = require('../files');

const appDirectory = fs.existsSync(dir.APP) ? dir.APP : dir.LEGACY_APP;

const serializerManifestEntry = file => {
  const fileUpdatedAt = Math.floor(new Date(fs.statSync(file)['mtime']) / 1000);
  return { physical_file_path: file.replace(new RegExp(`^${appDirectory}/`), ''), updated_at: fileUpdatedAt };
};

const generateManifest = async () => {
  let manifest = {};

  const assets  = await files.getAssets();

  for (const file of assets) {
    const path = file.replace(new RegExp(`(public|private)/assets/|(${appDirectory})/assets/`), '');
    manifest[path] = serializerManifestEntry(file);
  }

  return manifest;
};

module.exports = generateManifest;
