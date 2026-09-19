/**
 * A `.pos` for a test, in a directory of its own. Never in the repository root: test files run in
 * parallel processes, so one writing a config there changes what another sees, and a
 * save-and-restore helper cannot coordinate between processes.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

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
