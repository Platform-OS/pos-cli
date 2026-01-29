import archiver from 'archiver';
import fs from 'fs';
import glob from 'fast-glob';
import shell from 'shelljs';
import { fillInTemplateValues } from '../templates.js';
import { loadSettingsFileForModule } from '../settings.js';
import dir from '../directories.js';

const appDirectory = fs.existsSync(dir.APP) ? dir.APP : dir.LEGACY_APP;

const addModulesToArchive = async archive => {
  if (!fs.existsSync(dir.MODULES)) return Promise.resolve(true);

  let modules = await glob('./*', { cwd: dir.MODULES, onlyDirectories: true });
  for (const module of modules) {
    await addModuleToArchive(module, archive);
  }
};

const publicAssetsSameAsPrivate = (file, files) => {
  return file.startsWith('public/assets') && files.includes(file.replace(/public/, 'private'));
};

const addModuleToArchive = async (module, archive, pattern = '{public,private}/assets/**') => {
  let files = await glob(pattern, { cwd: `${dir.MODULES}/${module}` });
  for (const f of files) {
    if (publicAssetsSameAsPrivate(f, files)) {
      continue;
    }

    const path = `${dir.MODULES}/${module}/${f}`;
    const pathInArchive = path.replace(/(public|private)\/assets\//, '');
    const filledTemplate = fillInTemplateValues(path, loadSettingsFileForModule(module));
    archive.append(filledTemplate, {
      name: pathInArchive
    });
  }
};

const prepareDestination = path => {
  shell.mkdir('-p', 'tmp');
  if (path && path.length > 0) shell.rm('-rf', path);
};

const packAssets = async path => {
  prepareDestination(path);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(path);
    const assetsArchive = archiver('zip', { zlib: { level: 6 } });

    assetsArchive.on('error', err => {
      reject(err);
    });

    output.on('close', () => {
      resolve();
    });

    output.on('error', err => {
      reject(err);
    });

    assetsArchive.pipe(output);

    if (fs.existsSync(`${appDirectory}/assets`)) {
      assetsArchive.glob('**/*', { cwd: `${appDirectory}/assets` });
    }

    addModulesToArchive(assetsArchive)
      .then(() => {
        assetsArchive.finalize();
      })
      .catch(reject);
  });
};

export default packAssets;
