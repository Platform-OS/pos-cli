#!/usr/bin/env node

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { resolvePortalContext } from '../lib/dns/auth.js';
import { fetchDomains } from '../lib/dns/export.js';
import { renderCutovers } from '../lib/dns/cutover.js';
import { domainName } from '../lib/dns/exportSchema.js';
import { collect, filterByDomains, portalFlags, reportError } from '../lib/dns/cliHelpers.js';

program.showHelpAfterError();
program
  .name('pos-cli dns status')
  .arguments('[environment]')
  .option('--domain <name>', 'only show this domain (repeatable)', collect, [])
  .option('--instance-uuid <uuid>', 'instance uuid (skips lookup by the environment domain)')
  .option('--portal-url <url>', 'Partner Portal url (overrides the environment partner_portal_url)')
  .option('--token <token>', 'portal API token (overrides the environment token)')
  .option('--email <email>', 'authenticate with email + password prompt instead of a stored token')
  .option('--json', 'machine-readable output')
  .action(async (environment, params) => {
    try {
      const context = await resolvePortalContext(environment, {
        ...portalFlags(params),
        label: 'portal',
        readOnly: true
      });

      const { domains } = await fetchDomains(context.client, context.instanceUuid);
      const provisioned = filterByDomains(domains.filter(domain => domain.status), params.domain, domainName);

      if (params.json) {
        console.log(JSON.stringify({ portal: context.portalUrl, instance_uuid: context.instanceUuid, domains: provisioned }, null, 2));
      } else if (!provisioned.length) {
        await logger.Info(
          params.domain.length
            ? `No provisioned domain matching ${params.domain.join(', ')} on ${context.portalUrl} (instance ${context.instanceUuid}).`
            : `No provisioned domains on ${context.portalUrl} (instance ${context.instanceUuid}).`,
          { hideTimestamp: true }
        );
      } else {
        await logger.Info(
          `${context.portalUrl} (instance ${context.instanceUuid})\n\n${renderCutovers(provisioned)}`,
          { hideTimestamp: true }
        );
      }
    } catch (error) {
      await reportError(error);
    }
  });

program.parse(process.argv);
