/**
 * A directory of its own for one deploy's archives. The fixed `tmp/release.zip` and
 * `tmp/assets.zip` are safe for a CLI that runs one deploy and exits, not for a server that
 * answers while the deploy is still running and holds them until its asset upload finishes.
 *
 * Under the project's `tmp/` for the reason module staging is (CLAUDE.md): nothing enumerates it,
 * so a directory here cannot be deployed, packed or synced, and it is on the project's filesystem.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import log from '../log.js';

export const DEPLOY_WORK_ROOT = path.join('tmp', 'pos-cli-mcp-deploy');

/** @param {string} label - what the directory is for, so a leftover one says which call made it. */
export function makeWorkDir(label) {
  const workDir = path.join(DEPLOY_WORK_ROOT, `${label}-${randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });
  return workDir;
}

/** Best effort: the deploy has already settled, so a zip that will not delete must not fail it. */
export function removeWorkDir(workDir) {
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch (err) {
    log.debug('could not remove the deploy work directory', { workDir, error: String(err) });
  }
}
