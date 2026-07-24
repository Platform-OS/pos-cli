import chalk from 'chalk';
import table from 'text-table';

import { domainName } from './exportSchema.js';

const STATUS_MEANINGS = {
  ready: 'live on the target portal — cutover complete',
  initializing: 'the target portal is still provisioning — re-check in a minute',
  ownership_verification_pending: 'waiting for the DNS changes below',
  ssl_validation_pending: 'ownership verified — the SSL certificate is being issued',
  reparking_domain: 'the domain is being re-parked — re-check in a few minutes',
  not_found: 'the target portal found no hostname yet — apply may still be running or failed, check the portal',
  unknown: 'the target portal could not determine the state — check the portal'
};

const statusLine = (domain) => {
  const status = domain.substatus || domain.status || 'unknown';
  const meaning = STATUS_MEANINGS[status] || 'see the target portal';
  return `${chalk.bold(status)} — ${meaning}`;
};

const verificationRows = (details) =>
  (details.dns_verification_records || []).map(record => [
    `    ${record.resource_record_name}`,
    record.resource_record_type,
    record.resource_record_value
  ]);

// Per-domain "what to change where" block, rendered from a fresh target-portal
// GET /api/domains/<name> response after import.
const cutoverInstructions = (targetDomain) => {
  const name = domainName(targetDomain);
  const setupType = targetDomain?.attributes?.setup_type;
  const details = targetDomain?.details || {};
  const lines = [`${chalk.bold.underline(`CUTOVER ${name}`)} (${setupType})`, `  status: ${statusLine(targetDomain)}`];

  if ((targetDomain.substatus || targetDomain.status) === 'ready') {
    lines.push('  Nothing left to do for this domain.');
    return lines.join('\n');
  }

  if (setupType === 'domain-full') {
    const nameServers = details.dns_zone_name_servers || [];
    lines.push('  At your domain registrar, replace the nameservers with:');
    lines.push(nameServers.map(ns => `    ${ns}`).join('\n') || chalk.yellow('    (not assigned yet — re-check in a minute)'));
    lines.push('  DNS records are then served by the target portal zone — nothing else to change.');
  } else {
    const verification = verificationRows(details);
    let step = 1;
    if (verification.length) {
      lines.push(`  ${step}. Create/replace these SSL validation records at your DNS provider:`);
      lines.push(table(verification));
      step += 1;
    }
    lines.push(`  ${step}. Point the hostname at the target stack:`);
    if (details.private_lb_cname) lines.push(`    subdomains:  CNAME -> ${details.private_lb_cname}`);
    if (details.lb_public_ip) lines.push(`    apex:        A     -> ${details.lb_public_ip}`);
    if (!details.private_lb_cname && !details.lb_public_ip) {
      lines.push(chalk.yellow('    (target endpoints not published in the API response — check the target portal)'));
    }
    lines.push('  Once the records are in place, use the target portal\'s refresh to re-check validation, then run `pos-cli dns compare`.');
  }

  return lines.join('\n');
};

const renderCutovers = (targetDomains) =>
  targetDomains.filter(Boolean).map(cutoverInstructions).join('\n\n');

export { cutoverInstructions, renderCutovers, STATUS_MEANINGS };
