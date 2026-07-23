import { domainName } from './exportSchema.js';
import { transformDomain, isPlatformSubdomain } from './transform.js';
import { normalizeRecordValue, normalizeName, sortedRecordValues } from './normalize.js';

// Port of partner-portal scripts/pp-dns/ps-sg/compare-golden.rb.
//
// Default mode is CROSS-STACK: the source side is normalized through the transform
// (www-redirect record dropped, values normalized) and fields that legitimately differ
// between stacks are skipped — data_center, nameservers, and verification-record values
// (the target mints new DCV records by design). transform: false restores the exact
// same-stack golden-file semantics of the rb script.

const recordKey = (record, domain) =>
  `${normalizeName(record.name, domain) || '@'}/${(record.type || '').toUpperCase()}`;

const indexIntentRecords = (records, domain, { normalizeValues }) => {
  const index = new Map();
  for (const record of records || []) {
    const values = (record.records || []).map(value =>
      normalizeValues ? normalizeRecordValue((record.type || '').toUpperCase(), String(value)) : String(value)
    );
    const key = recordKey(record, domain);
    index.set(key, sortedRecordValues([...(index.get(key) || []), ...values]));
  }
  return index;
};

const indexLiveRecords = (records) => {
  const index = new Map();
  for (const record of records || []) {
    if (!record || typeof record !== 'object') continue;
    index.set(`${(record.name || '').toLowerCase()}/${(record.type || '').toUpperCase()}`, record);
  }
  return index;
};

const indexVerificationRecords = (records) => {
  const index = new Map();
  for (const record of records || []) {
    if (!record || typeof record !== 'object') continue;
    if (record.resource_record_name && record.resource_record_type) {
      index.set(`${record.resource_record_name.toLowerCase()}/${record.resource_record_type.toUpperCase()}`, record);
    } else if (record.txt_name) {
      index.set(`:raw_cf_shape:${record.txt_name}`, { ...record, ':shape': 'raw_cf' });
    }
  }
  return index;
};

// In transform mode BOTH sides pass through the transform: the target portal itself
// stores the auto-added www-redirect CNAME in config, so it must be dropped symmetrically
// or every www-redirect domain would diff as "only on target".
const intentFor = (domain, name, transform) => {
  if (!transform) {
    return indexIntentRecords(domain?.attributes?.config?.extra_dns_records, name, { normalizeValues: false });
  }
  const plan = transformDomain(domain, { targetInstanceUuid: 'compare' });
  const records = plan.payload ? plan.kept : (domain?.attributes?.config?.extra_dns_records || []);
  return indexIntentRecords(records, name, { normalizeValues: true });
};

const compareDomain = (sourceDomain, targetDomain, name, { transform, ignoreStatus }) => {
  const critical = [];
  const advisory = [];

  const sourceStatus = sourceDomain.status || null;
  const targetStatus = targetDomain.status || null;

  if (sourceStatus !== targetStatus) {
    const message = `status: source=${JSON.stringify(sourceStatus)}  target=${JSON.stringify(targetStatus)}`;
    (ignoreStatus ? advisory : critical).push(message);
  }

  const attributeKeys = transform ? ['setup_type'] : ['setup_type', 'data_center'];
  for (const key of attributeKeys) {
    const sourceValue = sourceDomain?.attributes?.[key];
    const targetValue = targetDomain?.attributes?.[key];
    if (sourceValue !== targetValue) {
      critical.push(`attributes.${key}: source=${JSON.stringify(sourceValue)}  target=${JSON.stringify(targetValue)}`);
    }
  }

  const sourceRecords = intentFor(sourceDomain, name, transform);
  const targetRecords = intentFor(targetDomain, name, transform);
  for (const key of new Set([...sourceRecords.keys(), ...targetRecords.keys()])) {
    const sourceValues = sourceRecords.get(key);
    const targetValues = targetRecords.get(key);
    if (!sourceValues) {
      critical.push(`extra_dns_records intent [${key}]: only on target (${JSON.stringify(targetValues)})`);
    } else if (!targetValues) {
      critical.push(`extra_dns_records intent [${key}]: missing on target (source: ${JSON.stringify(sourceValues)})`);
    } else if (JSON.stringify(sourceValues) !== JSON.stringify(targetValues)) {
      critical.push(
        `extra_dns_records intent [${key}] values differ:\n    source: ${JSON.stringify(sourceValues)}\n    target: ${JSON.stringify(targetValues)}`
      );
    }
  }

  const sourceVerification = indexVerificationRecords(sourceDomain?.details?.dns_verification_records);
  const targetVerification = indexVerificationRecords(targetDomain?.details?.dns_verification_records);
  for (const key of new Set([...sourceVerification.keys(), ...targetVerification.keys()]).values()) {
    const sourceRecord = sourceVerification.get(key);
    const targetRecord = targetVerification.get(key);
    if (targetRecord && targetRecord[':shape']) {
      const { ':shape': _shape, ...rest } = targetRecord;
      critical.push(`dns_verification_records [${key}] wrong shape on target: ${JSON.stringify(rest)}`);
    } else if (transform) {
      // Cross-stack: the target mints new DCV records; only the shape check above applies.
      continue;
    } else if (sourceRecord && !targetRecord) {
      critical.push(`dns_verification_records [${key}] missing on target\n    source: ${JSON.stringify(sourceRecord)}`);
    } else if (!sourceRecord && targetRecord) {
      advisory.push(`dns_verification_records [${key}] only on target\n    target: ${JSON.stringify(targetRecord)}`);
    } else if (sourceRecord && targetRecord && sourceRecord.resource_record_value !== targetRecord.resource_record_value) {
      critical.push(
        `dns_verification_records [${key}] value differs:\n    source: ${JSON.stringify(sourceRecord.resource_record_value)}\n    target: ${JSON.stringify(targetRecord.resource_record_value)}`
      );
    }
  }

  if (!!sourceDomain.has_pending !== !!targetDomain.has_pending) {
    advisory.push(`has_pending: source=${JSON.stringify(sourceDomain.has_pending)}  target=${JSON.stringify(targetDomain.has_pending)}`);
  }

  // Live values carry read-side noise (CF returns TXT quoted/chunked and lowercases
  // hostnames) — normalize in transform mode so advisories only flag real drift.
  const liveValues = (record) => {
    const values = (record.records || []).map(value =>
      transform ? normalizeRecordValue((record.type || '').toUpperCase(), String(value)) : String(value)
    );
    return sortedRecordValues(values);
  };
  const sourceLive = indexLiveRecords(sourceDomain?.details?.extra_dns_records);
  const targetLive = indexLiveRecords(targetDomain?.details?.extra_dns_records);
  for (const key of new Set([...sourceLive.keys(), ...targetLive.keys()])) {
    const sourceRecord = sourceLive.get(key);
    const targetRecord = targetLive.get(key);
    if (!sourceRecord) {
      advisory.push(`details.extra_dns_records [${key}]: only on target`);
    } else if (!targetRecord) {
      advisory.push(`details.extra_dns_records [${key}]: only on source`);
    } else if (JSON.stringify(liveValues(sourceRecord)) !== JSON.stringify(liveValues(targetRecord))) {
      advisory.push(
        `details.extra_dns_records [${key}] records differ:\n    source: ${JSON.stringify(sourceRecord.records)}\n    target: ${JSON.stringify(targetRecord.records)}`
      );
    }
  }

  if (!transform) {
    const sourceNs = [...(sourceDomain?.details?.dns_zone_name_servers || [])].sort();
    const targetNs = [...(targetDomain?.details?.dns_zone_name_servers || [])].sort();
    if (sourceNs.length && JSON.stringify(sourceNs) !== JSON.stringify(targetNs)) {
      advisory.push(`dns_zone_name_servers:\n    source: ${JSON.stringify(sourceNs)}\n    target: ${JSON.stringify(targetNs)}`);
    }
  }

  const level = critical.length ? 'CRITICAL' : (advisory.length ? 'ADVISORY' : 'OK');
  return { domainName: name, level, critical, advisory, status: targetStatus };
};

const indexDomains = (domains) => {
  const index = new Map();
  for (const domain of domains || []) {
    const name = domainName(domain);
    if (name) index.set(name, domain);
  }
  return index;
};

const compareInstance = (sourceDomains, targetDomains, { transform = true, ignoreStatus = false } = {}) => {
  const sourceIndex = indexDomains(sourceDomains);
  const targetIndex = indexDomains(targetDomains);
  const results = [];
  const totals = { ok: 0, advisory: 0, critical: 0, missingBefore: 0, missingAfter: 0 };

  const relevant = (name, domain) => {
    if (!domain) return false;
    if (transform && isPlatformSubdomain(name)) return false;
    return !!domain.status;
  };

  for (const name of [...new Set([...sourceIndex.keys(), ...targetIndex.keys()])].sort()) {
    const sourceDomain = sourceIndex.get(name);
    const targetDomain = targetIndex.get(name);
    const sourceRelevant = relevant(name, sourceDomain);
    const targetRelevant = relevant(name, targetDomain);

    if (!sourceRelevant && !targetRelevant) continue;
    if (!sourceDomain) {
      results.push({ domainName: name, level: 'MISSING_BEFORE', critical: [], advisory: [], status: targetDomain?.status });
      totals.missingBefore += 1;
      continue;
    }
    if (!targetDomain) {
      results.push({ domainName: name, level: 'MISSING_AFTER', critical: [], advisory: [], status: sourceDomain?.status });
      totals.missingAfter += 1;
      continue;
    }

    const result = compareDomain(sourceDomain, targetDomain, name, { transform, ignoreStatus });
    results.push(result);
    if (result.level === 'OK') totals.ok += 1;
    else if (result.level === 'ADVISORY') totals.advisory += 1;
    else totals.critical += 1;
  }

  return { results, totals };
};

export { compareInstance, compareDomain };
