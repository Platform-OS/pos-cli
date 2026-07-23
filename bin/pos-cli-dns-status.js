#!/usr/bin/env node

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { resolvePortalContext } from '../lib/dns/auth.js';
import { fetchDomains } from '../lib/dns/export.js';
import { renderCutovers } from '../lib/dns/cutover.js';
import { domainName } from '../lib/dns/exportSchema.js';

const collect = (value, previous) => previous.concat([value]);

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
        portalUrl: params.portalUrl,
        token: params.token,
        email: params.email,
        instanceUuid: params.instanceUuid,
        label: 'portal',
        readOnly: true
      });

      const { domains } = await fetchDomains(context.client, context.instanceUuid);
      const wanted = new Set(params.domain.map(name => name.toLowerCase()));
      const provisioned = domains.filter(domain =>
        domain.status && (!wanted.size || wanted.has((domainName(domain) || '').toLowerCase()))
      );

      if (params.json) {
        console.log(JSON.stringify({ portal: context.portalUrl, instance_uuid: context.instanceUuid, domains: provisioned }, null, 2));
      } else if (!provisioned.length) {
        await logger.Info(
          wanted.size
            ? `No provisioned domain matching ${[...wanted].join(', ')} on ${context.portalUrl} (instance ${context.instanceUuid}).`
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
      logger.Error(error.message || error);
    }
  });

program.parse(process.argv);
