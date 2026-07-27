#!/usr/bin/env node

import { program } from '../lib/program.js';

program
  .name('pos-cli dns')
  .command('export [environment]', 'export all domains and DNS records of an instance to a JSON file (backup/audit artifact)')
  .command('import [environment]', 'import domains and DNS records from an export file into a portal')
  .command('migrate [sourceEnv] [targetEnv]', 'migrate domains portal-to-portal: export, transform, import, print cutover instructions')
  .command('status [environment]', 'show each domain\'s provisioning status and pending cutover steps')
  .command('compare [sourceEnv] [targetEnv]', 'verify DNS parity between source and target instances (exit 1 on CRITICAL)')
  .parse(process.argv);
