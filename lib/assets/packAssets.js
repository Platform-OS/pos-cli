const archiver = require('archiver-promise'),
  fs = require('fs'),
  glob = require('glob'),
  shell = require('shelljs'),
  templates = require('../templates'),
  settings = require('../settings'),
  dir = require('../directories');

const appDirectory = fs.existsSync(dir.APP) ? dir.APP : dir.LEGACY_APP;

const addModulesToArchive = archive => {
  if (!fs.existsSync(dir.MODULES)) return true;

  const modules = glob.sync('*/', { cwd: dir.MODULES });
  for (const module of modules) {
    addModuleToArchive(module, archive);
  }
};

const publicAssetsSameAsPrivate = (file, files) => {
  return file.startsWith('public/assets') && files.includes(file.replace(/public/, 'private'));
};

const addModuleToArchive = (module, archive, pattern = '?(public|private)/assets/**') => {
  const files = glob.sync(pattern, { cwd: `${dir.MODULES}/${module}`, nodir: true });
  for (const f of files) {
    if (publicAssetsSameAsPrivate(f, files)) continue;

    const path = `${dir.MODULES}/${module}/${f}`;
    const pathInArchive = path.replace(/(public|private)\/assets\//, '');
    archive.append(templates.fillInTemplateValues(path, settings.loadSettingsFileForModule(module)), { name: pathInArchive });
  }
};

const prepareDestination = (path) => {
  shell.mkdir('-p', 'tmp');
  shell.rm('-rf', path);
};

const packAssets = async path => {
  prepareDestination(path);
  const assetsArchive = archiver(path, { zlib: { level: 6 }, store: true });
  assetsArchive.glob('**/**', { cwd: `${appDirectory}/assets` });
  addModulesToArchive(assetsArchive);
  return assetsArchive.finalize();
};

module.exports = packAssets;
