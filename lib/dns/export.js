import logger from '../logger.js';
import { buildEnvelope, domainName } from './exportSchema.js';

// A provisioned domain (non-empty status) must carry attributes.domain_name on v2.
// When the deployed portal ignores the version param (old backends), fall back to v1 —
// the name is then derived from config._domains by domainName().
const v2Supported = (domains) =>
  domains
    .filter(domain => domain && domain.status)
    .every(domain => domain.attributes && domain.attributes.domain_name);

const fetchDomains = async (client, instanceUuid, { apiVersion = 2 } = {}) => {
  let domains = await client.listDomains(instanceUuid, { version: apiVersion });
  if (!Array.isArray(domains)) domains = [];

  if (apiVersion === 2 && domains.length && !v2Supported(domains)) {
    await logger.Warn(`${client.baseUrl} did not return version=2 attributes — falling back to version=1.`);
    domains = await client.listDomains(instanceUuid, { version: 1 });
    if (!Array.isArray(domains)) domains = [];
    return { domains, apiVersion: 1 };
  }

  return { domains, apiVersion };
};

const exportInstance = async ({ client, instanceUuid, instanceUrl, envName, apiVersion = 2, raw = false }) => {
  const fetched = await fetchDomains(client, instanceUuid, { apiVersion });
  const envelope = buildEnvelope({
    portalUrl: client.baseUrl,
    apiVersion: fetched.apiVersion,
    instance: { uuid: instanceUuid, url: instanceUrl, env: envName },
    domains: fetched.domains,
    raw
  });
  const names = fetched.domains.map(domainName).filter(Boolean);
  return { envelope, names };
};

export { exportInstance, fetchDomains };
