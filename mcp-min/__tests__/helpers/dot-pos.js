/**
 * A `.pos` for a test, in a directory of its own.
 *
 * Never in the repository root: test files run in parallel processes, so one writing a config
 * there changes what another sees — `test/unit/lib/commands.test.js` spawns the real CLI and
 * asserts it finds no environments — and a save-and-restore helper cannot coordinate between
 * processes, so the file ends up resurrected and left behind. `CONFIG_FILE_PATH` is the first
 * path `files.getConfig()` looks at, so pointing it somewhere private is all that is needed.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * @param {object} environments - the `.pos` contents
 * @returns {{ dir: string, file: string, cleanup: () => void }}
 */
export function useDotPos(environments) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-dot-pos-'));
  const file = path.join(dir, '.pos');
  fs.writeFileSync(file, JSON.stringify(environments, null, 2));

  const previous = process.env.CONFIG_FILE_PATH;
  process.env.CONFIG_FILE_PATH = file;

  return {
    dir,
    file,
    cleanup() {
      if (previous === undefined) delete process.env.CONFIG_FILE_PATH;
      else process.env.CONFIG_FILE_PATH = previous;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

export default useDotPos;
