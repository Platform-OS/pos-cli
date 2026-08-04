/**
 * Staging area used to unpack module archives before they are swapped into
 * `modules/<name>`.
 *
 * A module is never extracted over its installed directory: the extraction lands in
 * a throwaway directory first, and only a complete, verified copy is moved into place
 * (see swapIntoPlace in downloadModule.js).
 */

import fs from 'fs';
import path from 'path';

/**
 * Staging lives under the project's `tmp/` — pos-cli's existing scratch directory, where
 * deploy already writes `tmp/release.zip`.
 *
 * Two properties make that the right home. Publishing a module ends in a `rename()` onto
 * `modules/<name>`, and `rename()` fails outright with EXDEV across filesystems, so the
 * staging area has to sit under the project root rather than in `os.tmpdir()` — a tmpfs
 * `/tmp` or a project on another drive would break it. And nothing enumerates project-root
 * `tmp/`: every glob over modules runs with `cwd` set to `modules/` (lib/archive.js,
 * lib/assets/packAssets.js, lib/files.js) and sync only watches `dir.toWatch()`, so a
 * half-extracted tree can never be deployed, packed, or synced.
 */
const getStagingBase = () => path.join(process.cwd(), 'tmp', 'pos-cli-module-staging');

/**
 * Creates an empty directory to extract one module archive into.
 *
 * mkdtemp supplies the random suffix and creates the directory atomically, so two
 * concurrent runs — or two installs of the same module — can never land in the same place.
 */
const createStagingDir = async (moduleName) => {
  const base = getStagingBase();
  await fs.promises.mkdir(base, { recursive: true });

  return fs.promises.mkdtemp(path.join(base, `pos-cli-unpack-${moduleName}-`));
};

/**
 * Removes the staging base and anything left inside it — including leftovers from an
 * earlier killed run. Only safe once every download of the current run has settled.
 */
const clearStagingBase = () =>
  fs.promises.rm(getStagingBase(), { recursive: true, force: true }).catch(() => {});

export { createStagingDir, clearStagingBase, getStagingBase };
