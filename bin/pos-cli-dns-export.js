#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import ora from 'ora';

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { resolvePortalContext } from '../lib/dns/auth.js';
import { exportInstance } from '../lib/dns/export.js';

const defaultFilename = (instanceUuid) =>
  `dns-export-${instanceUuid}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

const resolveOutPath = (out, instanceUuid) => {
  if (!out) return defaultFilename(instanceUuid);
  if (fs.existsSync(out) && fs.statSync(out).isDirectory()) {
    return path.join(out, `${instanceUuid}.json`);
  }
  return out;
};

program.showHelpAfterError();
program
  .name('pos-cli dns export')
  .arguments('[environment]')
  .option('-o, --out <path>', 'output file (or existing directory, writes <uuid>.json inside)')
  .option('--instance-uuid <uuid>', 'instance uuid (skips lookup by the environment domain)')
  .option('--portal-url <url>', 'Partner Portal url (overrides the environment partner_portal_url)')
  .option('--token <token>', 'portal API token (overrides the environment token)')
  .option('--email <email>', 'authenticate with email + password prompt instead of a stored token')
  .option('--api-version <version>', 'domains API version to request', '2')
  .option('--raw', 'keep the full response verbatim, including legacy Terraform state blobs')
  .action(async (environment, params) => {
    const spinner = ora({ text: 'Exporting DNS', stream: process.stdout });
    try {
      const context = await resolvePortalContext(environment, {
        portalUrl: params.portalUrl,
        token: params.token,
        email: params.email,
        instanceUuid: params.instanceUuid,
        label: 'source',
        readOnly: true
      });

      spinner.start(`Exporting ${context.instanceUuid}`);
      const { envelope, names } = await exportInstance({
        client: context.client,
        instanceUuid: context.instanceUuid,
        instanceUrl: context.instanceUrl,
        envName: environment,
        apiVersion: parseInt(params.apiVersion, 10),
        raw: !!params.raw
      });

      const outPath = resolveOutPath(params.out, context.instanceUuid);
      fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(envelope, null, 2));

      spinner.succeed(
        `Exported ${envelope.domains.length} domain entr${envelope.domains.length === 1 ? 'y' : 'ies'} ` +
        `(${names.join(', ') || 'none provisioned'}) from ${context.portalUrl} to ${outPath}`
      );
    } catch (error) {
      spinner.stop();
      logger.Error(error.message || error);
    }
  });

program.parse(process.argv);
