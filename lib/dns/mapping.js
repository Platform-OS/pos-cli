import fs from 'fs';

import { fetchDomains } from './export.js';
import { domainName } from './exportSchema.js';
import { isPlatformSubdomain } from './transform.js';

const UUID_LINE = /^[a-z0-9][a-z0-9-]*$/i;

// One source instance uuid per line; blank lines and #comments ignored.
const parseInstancesFile = (path) =>
  fs.readFileSync(path, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      if (!UUID_LINE.test(line)) throw new Error(`${path}: "${line}" does not look like an instance uuid`);
      return line;
    });

const parseCsvMapping = (content, path) => {
  const rows = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  const pairs = [];
  for (const row of rows) {
    const [sourceUuid, targetUuid, label] = row.split(',').map(cell => cell?.trim());
    if (sourceUuid === 'source_uuid' && targetUuid === 'target_uuid') continue; // header
    if (!sourceUuid || !targetUuid) {
      throw new Error(`${path}: expected "source_uuid,target_uuid[,label]" — got "${row}"`);
    }
    pairs.push({ sourceUuid, targetUuid, label: label || sourceUuid });
  }
  return pairs;
};

const parseJsonMapping = (content, path) => {
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) throw new Error(`${path}: expected a JSON array of {source_uuid, target_uuid, label?}`);
  return parsed.map((entry, index) => {
    const sourceUuid = entry.source_uuid || entry.sourceUuid;
    const targetUuid = entry.target_uuid || entry.targetUuid;
    if (!sourceUuid || !targetUuid) throw new Error(`${path}[${index}]: missing source_uuid or target_uuid`);
    return { sourceUuid, targetUuid, label: entry.label || sourceUuid };
  });
};

// CSV `source_uuid,target_uuid[,label]` or a JSON array — returns [{sourceUuid, targetUuid, label}].
const parseMappingFile = (path) => {
  const content = fs.readFileSync(path, 'utf8');
  const pairs = content.trimStart().startsWith('[') ? parseJsonMapping(content, path) : parseCsvMapping(content, path);
  if (!pairs.length) throw new Error(`${path}: no instance pairs found`);
  return pairs;
};

// Resolves the target instance for a source instance by its customer domains:
// every provisioned primary domain of the source must point at the same target
// instance, otherwise this errors instead of guessing.
const matchByDomain = async ({ sourceClient, targetClient, sourceUuid }) => {
  const { domains } = await fetchDomains(sourceClient, sourceUuid);
  const names = domains
    .filter(domain => domain.status)
    .map(domainName)
    .filter(name => name && !isPlatformSubdomain(name));
  if (!names.length) {
    throw new Error(`source instance ${sourceUuid} has no provisioned customer domains to match by — provide a mapping file entry`);
  }

  const matches = new Map();
  for (const name of names) {
    let response;
    try {
      response = await targetClient.searchInstances({ domain: name });
    } catch (error) {
      // A failed lookup must not masquerade as "no matching instance" (TASK-1.14).
      throw new Error(`instance lookup for ${name} on ${targetClient.baseUrl} failed: ${error.message}`);
    }
    for (const instance of response?.data || []) matches.set(instance.uuid, instance.name);
  }

  if (matches.size === 1) return [...matches.keys()][0];
  if (matches.size === 0) {
    throw new Error(`no instance on ${targetClient.baseUrl} has any of the domains ${names.join(', ')} — create the target instance domains first or provide a mapping file`);
  }
  const listing = [...matches.entries()].map(([uuid, name]) => `${uuid} (${name})`).join(', ');
  throw new Error(`domains of source instance ${sourceUuid} matched multiple target instances: ${listing} — provide a mapping file entry`);
};

export { parseInstancesFile, parseMappingFile, matchByDomain };
