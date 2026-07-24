// Record-noise normalizers shared by transform (what we send) and compare (what we diff).
// Rules mirror partner-portal's Api::Record validation and Cloudflare read-side quirks:
// CF lowercases hostnames and returns TXT quoted (long values chunked into 255-byte quoted
// parts); the new stack's MX validation rejects a trailing dot on the host.

const stripTrailingDot = (value) => value.replace(/\.$/, '');

const HOST_TYPES = new Set(['CNAME', 'ALIAS', 'NS', 'PTR']);

// '"part-one" "part-two"' -> 'part-onepart-two'; '"quoted"' -> 'quoted'; unquoted stays as-is.
const normalizeTxtValue = (value) => {
  const trimmed = value.trim();
  if (!/^".*"$/s.test(trimmed)) return value;
  const chunks = trimmed.match(/"((?:[^"\\]|\\.)*)"/g);
  if (!chunks) return value;
  return chunks.map(chunk => chunk.slice(1, -1)).join('');
};

const normalizeMxValue = (value) => {
  const [priority, ...host] = value.trim().split(/\s+/);
  return [priority, stripTrailingDot(host.join(' ').toLowerCase())].join(' ');
};

const normalizeSrvValue = (value) => {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 4) return value.trim().toLowerCase();
  const target = stripTrailingDot(parts.slice(3).join(' ').toLowerCase());
  return [...parts.slice(0, 3), target].join(' ');
};

const normalizeRecordValue = (type, value) => {
  switch (type) {
    case 'TXT':
    case 'SPF':
      return normalizeTxtValue(value);
    case 'MX':
      return normalizeMxValue(value);
    case 'SRV':
      return normalizeSrvValue(value);
    default:
      return HOST_TYPES.has(type) ? stripTrailingDot(value.trim().toLowerCase()) : value.trim();
  }
};

// Canonical record-name form: lowercase, short (relative to the domain), '' for apex.
const normalizeName = (name, domainName) => {
  let short = (name || '').trim().toLowerCase().replace(/\.$/, '');
  if (short === '@' || short === domainName) return '';
  if (domainName && short.endsWith(`.${domainName}`)) short = short.slice(0, -(domainName.length + 1));
  return short;
};

const sortedRecordValues = (values) => [...values].sort();

export {
  normalizeTxtValue,
  normalizeMxValue,
  normalizeSrvValue,
  normalizeRecordValue,
  normalizeName,
  sortedRecordValues,
  stripTrailingDot
};
