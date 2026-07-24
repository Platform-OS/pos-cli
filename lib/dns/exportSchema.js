import fs from 'fs';

const SCHEMA_PREFIX = 'pos-cli/dns-export/v';
const SCHEMA_MAJOR = 1;
const SCHEMA = `${SCHEMA_PREFIX}${SCHEMA_MAJOR}`;

// The old-stack v2 payload embeds the legacy pp-dns Terraform state under details.state —
// thousands of lines of backend cruft with no migration value. Anything else oversized is
// dropped defensively so export files stay reviewable.
const MAX_DETAIL_VALUE_BYTES = 100 * 1024;

const domainName = (domain) =>
  domain?.attributes?.domain_name ||
  domain?.attributes?.config?._domains?.find(d => d?.name)?.name ||
  null;

const isStrippedDetail = (value) => typeof value === 'string' && value.startsWith('[stripped:');

const stripBulkyDetails = (domain) => {
  let source = domain;
  if (domain?.details && typeof domain.details === 'object' && 'state' in domain.details) {
    // Exclude the legacy Terraform blob BEFORE the deep clone — it can be hundreds of
    // KB per domain and would otherwise be copied only to be deleted again.
    const { state: _state, ...details } = domain.details;
    source = { ...domain, details };
  }
  const copy = structuredClone(source);
  if (copy && copy.details && typeof copy.details === 'object') {
    delete copy.details.state;
    for (const [key, value] of Object.entries(copy.details)) {
      if (JSON.stringify(value ?? null).length > MAX_DETAIL_VALUE_BYTES) {
        copy.details[key] = `[stripped: ${key} exceeded ${MAX_DETAIL_VALUE_BYTES} bytes]`;
      }
    }
  }
  return copy;
};

const buildEnvelope = ({ portalUrl, apiVersion, instance, domains, raw = false }) => ({
  schema: SCHEMA,
  exported_at: new Date().toISOString(),
  portal_url: portalUrl,
  api_version: apiVersion,
  instance,
  domains: raw ? domains : domains.map(stripBulkyDetails)
});

// Read + validate an export file in one step — shared by dns import and dns compare.
const readEnvelope = (filePath) => validateEnvelope(JSON.parse(fs.readFileSync(filePath, 'utf8')));

const validateEnvelope = (json) => {
  if (!json || typeof json !== 'object') throw new Error('Not a dns export file (expected a JSON object).');
  const schema = json.schema;
  if (typeof schema !== 'string' || !schema.startsWith(SCHEMA_PREFIX)) {
    throw new Error(`Not a dns export file (missing "schema: ${SCHEMA}").`);
  }
  const major = parseInt(schema.slice(SCHEMA_PREFIX.length), 10);
  if (major !== SCHEMA_MAJOR) {
    throw new Error(`Unsupported export schema ${schema} — this pos-cli understands ${SCHEMA}. Upgrade pos-cli or re-export.`);
  }
  if (!json.instance || !json.instance.uuid) throw new Error('Export file is missing instance.uuid.');
  if (!Array.isArray(json.domains)) throw new Error('Export file is missing the domains array.');
  return json;
};

export { SCHEMA, buildEnvelope, stripBulkyDetails, validateEnvelope, readEnvelope, domainName, isStrippedDetail };
