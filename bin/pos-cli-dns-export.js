#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import ora from 'ora';

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { resolvePortalContext } from '../lib/dns/auth.js';
import { exportInstance } from '../lib/dns/export.js';
import { parseInstancesFile } from '../lib/dns/mapping.js';
import { backupPathFor, portalFlags, timestamp, writeEnvelope, reportError } from '../lib/dns/cliHelpers.js';

program.showHelpAfterError();
program
  .name('pos-cli dns export')
  .arguments('[environment]')
  .option('-o, --out <path>', 'output file (or existing directory, writes <uuid>.json inside)')
  .option('--instance-uuid <uuid>', 'instance uuid (skips lookup by the environment domain)')
  .option('--instances-file <path>', 'bulk: instance uuids (one per line), writes <out-dir>/<uuid>.json per instance')
  .option('--portal-url <url>', 'Partner Portal url (overrides the environment partner_portal_url)')
  .option('--token <token>', 'portal API token (overrides the environment token)')
  .option('--email <email>', 'authenticate with email + password prompt instead of a stored token')
  .option('--api-version <version>', 'domains API version to request', '2')
  .option('--raw', 'keep the full response verbatim, including legacy Terraform state blobs')
  .action(async (environment, params) => {
    const spinner = ora({ text: 'Exporting DNS', stream: process.stdout });
    try {
      const bulk = !!params.instancesFile;
      const context = await resolvePortalContext(environment, {
        ...portalFlags(params),
        label: 'source',
        readOnly: true,
        skipInstanceLookup: bulk
      });

      const uuids = bulk ? parseInstancesFile(params.instancesFile) : [context.instanceUuid];
      const outDir = bulk ? (params.out || `dns-export-${timestamp()}`) : null;
      if (outDir) fs.mkdirSync(outDir, { recursive: true });

      let failures = 0;
      for (const uuid of uuids) {
        spinner.start(`Exporting ${uuid}`);
        try {
          const { envelope, names } = await exportInstance({
            client: context.client,
            instanceUuid: uuid,
            instanceUrl: bulk ? undefined : context.instanceUrl,
            envName: environment,
            apiVersion: parseInt(params.apiVersion, 10),
            raw: !!params.raw
          });

          const outPath = bulk ? path.join(outDir, `${uuid}.json`) : backupPathFor(params.out, uuid);
          writeEnvelope(outPath, envelope);

          spinner.succeed(
            `Exported ${envelope.domains.length} domain entr${envelope.domains.length === 1 ? 'y' : 'ies'} ` +
            `(${names.join(', ') || 'none provisioned'}) from ${context.portalUrl} to ${outPath}`
          );
        } catch (error) {
          spinner.stop();
          failures += 1;
          await logger.Warn(`${uuid}: export failed — ${error.message}`);
        }
      }

      if (failures) {
        await logger.Error(`${failures} of ${uuids.length} exports failed.`, { exit: false });
        process.exit(1);
      }
    } catch (error) {
      spinner.stop();
      await reportError(error);
    }
  });

program.parse(process.argv);
