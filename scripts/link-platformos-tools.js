#!/usr/bin/env node

/**
 * Links local @platformos/* packages from a platformos-tools checkout into pos-cli.
 *
 * Usage:
 *   node scripts/link-platformos-tools.js <path-to-platformos-tools>
 *   node scripts/link-platformos-tools.js --unlink
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const args = process.argv.slice(2);
const posCLIRoot = resolve(import.meta.dirname, '..');

if (args[0] === '--unlink') {
  unlink();
} else if (args.length === 1) {
  link(args[0]);
} else {
  console.error('Usage:');
  console.error('  node scripts/link-platformos-tools.js <path-to-platformos-tools>');
  console.error('  node scripts/link-platformos-tools.js --unlink');
  process.exit(1);
}

function discoverPackages(toolsRoot) {
  const packagesDir = join(toolsRoot, 'packages');
  if (!existsSync(packagesDir)) {
    console.error(`Error: ${packagesDir} does not exist.`);
    process.exit(1);
  }

  const packages = [];
  for (const dir of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const pkgJsonPath = join(packagesDir, dir.name, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    if (pkgJson.name && pkgJson.name.startsWith('@platformos/')) {
      packages.push({ name: pkgJson.name, path: join(packagesDir, dir.name) });
    }
  }

  return packages;
}

function run(cmd, cwd) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function link(toolsPath) {
  const toolsRoot = resolve(toolsPath);
  if (!existsSync(toolsRoot)) {
    console.error(`Error: ${toolsRoot} does not exist.`);
    process.exit(1);
  }

  const packages = discoverPackages(toolsRoot);
  if (packages.length === 0) {
    console.error('Error: No @platformos/* packages found.');
    process.exit(1);
  }

  console.log(`Found ${packages.length} @platformos packages:\n`);
  for (const pkg of packages) {
    console.log(`  ${pkg.name}`);
  }

  // Step 1: Register each package globally via npm link
  console.log('\nRegistering packages globally...\n');
  for (const pkg of packages) {
    run('npm link', pkg.path);
  }

  // Step 2: Link all packages into pos-cli in one command
  const names = packages.map((p) => p.name).join(' ');
  console.log('\nLinking packages into pos-cli...\n');
  run(`npm link ${names}`, posCLIRoot);

  console.log('\nDone! Local @platformos packages are now linked.');
  console.log('Run "node scripts/link-platformos-tools.js --unlink" to restore npm versions.');
}

function unlink() {
  console.log('Unlinking @platformos packages and restoring npm versions...\n');
  run('npm install', posCLIRoot);
  console.log('\nDone! npm versions restored.');
}
