import fs from 'fs';
import normalize from 'normalize-path';
import dir from '../directories.js';
import files from '../files.js';

const appDirectory = fs.existsSync(dir.APP) ? dir.APP : dir.LEGACY_APP;

const serializerManifestEntry = file => {
  const fileProperties = fs.statSync(file);
  const fileUpdatedAt = Math.floor(new Date(fileProperties['mtime']) / 1000);
  const fileSize = fileProperties['size'];
  return { physical_file_path: file.replace(new RegExp(`^${appDirectory}/`), ''), updated_at: fileUpdatedAt, file_size: fileSize };
};

const manifestGenerate = async () => {
  const assets  = await files.getAssets();
  return manifestGenerateForAssets(assets);
};

const manifestGenerateForAssets = (assets) => {
  let manifest = {};
  for (const file of assets) {
    const normalizedFile = normalize(file);
    const path = normalizedFile.replace(new RegExp(`(public|private)/assets/|(${appDirectory})/assets/`), '');
    manifest[path] = serializerManifestEntry(normalizedFile);
  }

  return manifest;
};

export { manifestGenerate, manifestGenerateForAssets };
