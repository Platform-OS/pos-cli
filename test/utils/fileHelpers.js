import fs from 'fs';
import path from 'path';

/**
 * Returns a set of file-write helpers bound to the given getTmpDir function.
 * Intended to be used with withTmpDir:
 *
 *   const getTmpDir = withTmpDir();
 *   const { writeManifest, writeLock, writeLegacyManifest, writeLegacyLock } = makeFileHelpers(getTmpDir);
 */
const makeFileHelpers = (getTmpDir) => ({
  writeManifest: (content) =>
    fs.writeFileSync(path.join(getTmpDir(), 'pos-module.json'), JSON.stringify(content, null, 2)),

  writeLock: (content) =>
    fs.writeFileSync(path.join(getTmpDir(), 'pos-module.lock.json'), JSON.stringify(content, null, 2)),

  writeLegacyManifest: (content) => {
    fs.mkdirSync(path.join(getTmpDir(), 'app'), { recursive: true });
    fs.writeFileSync(path.join(getTmpDir(), 'app', 'pos-modules.json'), JSON.stringify(content, null, 2));
  },

  writeLegacyLock: (content) => {
    fs.mkdirSync(path.join(getTmpDir(), 'app'), { recursive: true });
    fs.writeFileSync(path.join(getTmpDir(), 'app', 'pos-modules.lock.json'), JSON.stringify(content, null, 2));
  },

  writeTemplateValues: (moduleName, content) => {
    fs.mkdirSync(path.join(getTmpDir(), 'modules', moduleName), { recursive: true });
    fs.writeFileSync(
      path.join(getTmpDir(), 'modules', moduleName, 'template-values.json'),
      JSON.stringify(content, null, 2)
    );
  },

  writeAppManifest: (content) => {
    fs.mkdirSync(path.join(getTmpDir(), 'app'), { recursive: true });
    fs.writeFileSync(path.join(getTmpDir(), 'app', 'pos-module.json'), JSON.stringify(content, null, 2));
  },
});

export { makeFileHelpers };
