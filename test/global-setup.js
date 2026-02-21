import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliPath = `node ${path.join(__dirname, '../bin/pos-cli.js')}`;

export async function setup() {
  dotenv.config();

  const { MPKIT_URL, MPKIT_TOKEN, MPKIT_EMAIL } = process.env;
  if (!MPKIT_URL || !MPKIT_TOKEN || !MPKIT_EMAIL || MPKIT_URL.includes('example.com')) {
    console.log('[Global Setup] No real credentials found, skipping instance cleanup');
    return;
  }

  console.log(`[Global Setup] Cleaning instance: ${MPKIT_URL}`);
  execSync(`${cliPath} data clean --include-schema --auto-confirm`, {
    env: process.env,
    stdio: 'inherit'
  });
  console.log('[Global Setup] Instance cleaned');
}
