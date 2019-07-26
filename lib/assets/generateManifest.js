const fs = require('fs'),
  glob = require('glob'),
  tg = require('tiny-glob'),
  dir = require('../directories');

const appDirectory = fs.existsSync(dir.APP) ? dir.APP : dir.LEGACY_APP;

const serializerManifestEntry = file => {
  const fileUpdatedAt = Math.floor(new Date(fs.statSync(file)['mtime']) / 1000);
  return { physical_file_path: file.replace(new RegExp(`^${appDirectory}/`), ''), updated_at: fileUpdatedAt };
};

const generateManifest = () => {
  let manifest = {};
  const files = glob.sync(`${appDirectory}/assets/**/*`, { nodir: true });
  for (const file of files) {
    const path = file.replace(new RegExp(`(public|private)/assets/|(${appDirectory})/assets/`), '');
    manifest[path] = serializerManifestEntry(file);
  }

  const modulesFiles = glob.sync('modules/**/?(public|private)/assets/**/*', { nodir: true });
  for (let file of modulesFiles) {
    const path = file.replace(new RegExp(`(public|private)/assets/|(${appDirectory})/assets/`), '');
    manifest[path] = serializerManifestEntry(file);
  }
  return manifest;
};

(async () => {
  const g = `${appDirectory}/assets/**/*`;
  const g2 = 'modules/**/?(public|private)/assets/**/*';

  const old = glob.sync(g2, { nodir: true });
  const newg = await tg(g2, { filesOnly: true });

  console.log(old);
  console.log(newg);

})();

module.exports = generateManifest;
