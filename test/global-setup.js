import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { isExampleUrl } from './utils/credentials.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliScript = path.join(__dirname, '../bin/pos-cli.js');

export async function setup() {
  dotenv.config();

  const { MPKIT_URL, MPKIT_TOKEN, MPKIT_EMAIL } = process.env;
  if (!MPKIT_URL || !MPKIT_TOKEN || !MPKIT_EMAIL || isExampleUrl(MPKIT_URL)) {
    console.log('[Global Setup] No real credentials found, skipping instance cleanup');
    return;
  }

  console.log(`[Global Setup] Cleaning instance: ${MPKIT_URL}`);
  // execFileSync, not execSync: the repo path goes into argv, and a shell would split it on
  // spaces and re-read any metacharacter in it before node ever saw the script name.
  execFileSync(process.execPath, [cliScript, 'data', 'clean', '--include-schema', '--auto-confirm'], {
    env: process.env,
    stdio: 'inherit'
  });
  console.log('[Global Setup] Instance cleaned');
}
