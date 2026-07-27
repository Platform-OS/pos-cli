import { domainName } from './exportSchema.js';
import { normalizeRecordValue, normalizeName } from './normalize.js';

// Valid types per partner-portal app/models/api/record.rb on the private-stack branch.
const VALID_TYPES = new Set(['A', 'TXT', 'ALIAS', 'CNAME', 'MX', 'PTR', 'SRV', 'SPF', 'NS']);
const NAME_FORMAT = /^[a-z0-9_.-]*$/;
const MX_FORMAT = /^\d{1,3}\s\S+$/;
const SRV_FORMAT = /^\d{1,5}\s\d{1,5}\s\d{1,5}\s\S+$/;
const DEFAULT_TTL = 3600;

// extra_dns_records carries ONLY customer-created records (platform fallback/service records
// are never exposed by the API), so nothing platform-side needs filtering here. Values that
// reference old-stack infrastructure are still customer records — keep them, but flag for review.
const OLD_INFRA_PATTERNS = [/\.elb\.amazonaws\.com\.?$/i, /^_fallback\./i];

const deriveEnableWwwRedirect = (domain) =>
  domain?.www_redirect?.enabled ?? !!domain?.attributes?.config?.enable_www_redirect;

const deriveSetupType = (domain) =>
  domain?.attributes?.setup_type ||
  ((domain?.details?.dns_zone_name_servers || []).length ? 'domain-full' : 'domain-external');

// The POST's use_as_default applies to the www companion when the redirect is on
// (Api::DomainsController#domain_bundle), so honor whichever of the pair holds it.
const deriveUseAsDefault = (domain, name) => {
  const domains = domain?.attributes?.config?._domains || [];
  return domains.some(entry => [name, `www.${name}`].includes(entry?.name) && entry.use_as_default);
};

// record.name and record.records[0] arrive lowercased (normalizeName/normalizeRecordValue),
// but `name` is the raw domain name — legacy portals allow mixed case ('Example.com').
const isWwwRedirectRecord = (record, name) =>
  record.name === 'www' && record.type === 'CNAME' && record.records.length === 1 &&
  record.records[0] === (name || '').toLowerCase();

const isPlatformSubdomain = (name) => /\.(platform-os\.com|platformos\.dev)$/i.test(name || '');

const describeRecord = (record) => `${record.name || '@'} ${record.type} -> ${record.records.join(', ')}`;

const validateRecord = (record) => {
  if (!VALID_TYPES.has(record.type)) {
    return `record "${describeRecord(record)}": type ${record.type} is not supported by the target portal (${[...VALID_TYPES].join(', ')})`;
  }
  if (!NAME_FORMAT.test(record.name)) {
    return `record "${describeRecord(record)}": name is invalid — allowed characters are a-z, 0-9, '_', '.', '-'`;
  }
  if (!record.records.length) {
    return `record "${describeRecord(record)}": has no values`;
  }
  if (['CNAME', 'ALIAS'].includes(record.type) && record.records.length > 1) {
    return `record "${record.name || '@'}" (${record.type}): the target accepts exactly one value — split into separate records or fix at source`;
  }
  if (record.type === 'MX' && !record.records.every(value => MX_FORMAT.test(value))) {
    return `record "${describeRecord(record)}": invalid MX value — expected "<priority> <mail host>"`;
  }
  if (record.type === 'SRV' && !record.records.every(value => SRV_FORMAT.test(value))) {
    return `record "${describeRecord(record)}": invalid SRV value — expected "<priority> <weight> <port> <target>"`;
  }
  return null;
};

// Pure transform of one source domain-status object into a target POST /api/domains payload.
// Returns { domainName, payload|null, kept, dropped, errors, warnings, skipped }.
const transformDomain = (sourceDomain, { targetInstanceUuid, dropValuePatterns = [] } = {}) => {
  const name = domainName(sourceDomain);
  const result = { domainName: name, payload: null, kept: [], dropped: [], errors: [], warnings: [], skipped: false };

  if (!name) {
    result.errors.push('cannot determine the domain name from the export entry');
    return result;
  }
  if (!sourceDomain.status) {
    result.skipped = true;
    result.skipReason = 'not provisioned on the source portal — nothing to migrate';
    return result;
  }
  if (isPlatformSubdomain(name)) {
    result.skipped = true;
    result.skipReason = 'platform subdomain — the target instance has its own';
    return result;
  }

  const enableWwwRedirect = deriveEnableWwwRedirect(sourceDomain);
  const sourceRecords = sourceDomain?.attributes?.config?.extra_dns_records || [];

  for (const raw of sourceRecords) {
    const type = (raw.type || '').toUpperCase();
    const record = {
      name: normalizeName(raw.name, name),
      type,
      ttl: raw.ttl || DEFAULT_TTL,
      records: (raw.records || []).map(value => normalizeRecordValue(type, String(value)))
    };
    if (typeof raw.proxied === 'boolean') record.proxied = raw.proxied;

    if (enableWwwRedirect && isWwwRedirectRecord(record, name)) {
      result.dropped.push({ record, reason: 'auto-added by the target portal from enable_www_redirect' });
      continue;
    }

    const dropPattern = dropValuePatterns.find(pattern => record.records.some(value => pattern.test(value)));
    if (dropPattern) {
      result.dropped.push({ record, reason: `matches --drop-value ${dropPattern}` });
      continue;
    }

    const error = validateRecord(record);
    if (error) {
      result.errors.push(error);
      continue;
    }

    if (OLD_INFRA_PATTERNS.some(pattern => record.records.some(value => pattern.test(value)))) {
      result.warnings.push(
        `record "${describeRecord(record)}" points at old-stack infrastructure — verify it is still needed after migration`
      );
    }

    result.kept.push(record);
  }

  if (result.errors.length) return result;

  const setupType = deriveSetupType(sourceDomain);
  if (setupType === 'domain-external' && result.kept.length) {
    result.warnings.push(
      'domain-external: the records are stored on the target portal but not applied anywhere — your own DNS provider remains authoritative for this domain'
    );
  }

  result.payload = {
    name,
    instance_uuid: targetInstanceUuid,
    setup_type: setupType,
    use_as_default: deriveUseAsDefault(sourceDomain, name),
    enable_www_redirect: enableWwwRedirect,
    extra_dns_records: result.kept
  };
  return result;
};

const transformEnvelope = (envelope, options = {}) => {
  const plans = (envelope.domains || []).map(domain => transformDomain(domain, options));
  const errors = plans.flatMap(plan =>
    plan.errors.map(error => `${plan.domainName || '(unknown domain)'}: ${error}`)
  );
  return { plans, errors };
};

export {
  transformDomain,
  transformEnvelope,
  deriveEnableWwwRedirect,
  deriveSetupType,
  deriveUseAsDefault,
  isPlatformSubdomain
};
