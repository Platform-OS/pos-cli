import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';

import { loadSettingsFileForModule } from '../settings.js';
import dir from '../directories.js';
import prepareArchive from '../prepareArchive.js';

const addModulesToArchive = async archive => {
  if (!fs.existsSync(dir.MODULES)) return Promise.resolve(true);

  const modules = await glob('./*', { cwd: dir.MODULES, onlyDirectories: true });
  for (const module of modules) {
    await addModuleToArchive(module, archive);
  }
};

const publicAssetsSameAsPrivate = (file, files) => {
  return file.startsWith('public/assets') && files.includes(file.replace(/public/, 'private'));
};

const addModuleToArchive = async (module, archive, pattern = '{public,private}/assets/**') => {
  const files = await glob(pattern, { cwd: path.join(dir.MODULES, module), onlyFiles: true });
  for (const f of files) {
    if (publicAssetsSameAsPrivate(f, files)) {
      continue;
    }
    const realPath = path.join(dir.MODULES, module, f);
    const nameInArchive = realPath.split(path.sep).join('/').replace(/(public|private)\/assets\//, '');
    archive.appendTemplated(realPath, nameInArchive, loadSettingsFileForModule(module));
  }
};

const packAssets = async outputPath => {
  const appDirectory = fs.existsSync(dir.APP) ? dir.APP : dir.LEGACY_APP;
  const archive = prepareArchive(outputPath);

  if (fs.existsSync(`${appDirectory}/assets`)) {
    const assetFiles = await glob('**/*', { cwd: `${appDirectory}/assets`, onlyFiles: true, dot: true });
    for (const f of assetFiles) {
      archive.addFile(path.join(appDirectory, 'assets', f), f);
    }
  }

  await addModulesToArchive(archive);
  archive.finalize();

  return archive.done;
};

export default packAssets;
