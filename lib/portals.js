import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeFileOwnerOnly } from './filePermissions.js';
import logger from './logger.js';

/**
 * The Partner Portals this machine is signed in to, each under a name of the operator's
 * choosing -- the counterpart of .pos, but for portals instead of instances, like
 * kubectl's contexts:
 *
 *   { "shared": { "url": "https://partners.platformos.com", "token": "<global token>", ... } }
 *
 * `pos-cli portal add <name>` puts a global token here; `pos-cli env add <env> --url <site>
 * --portal <name>` then writes an environment that names the portal instead of carrying a
 * token of its own, so one token -- and one two-factor session -- serves every instance on
 * that portal it reaches.
 *
 * Not ~/.pos: .pos is looked up in the working directory (files.js), so running pos-cli
 * from $HOME would read a portals file there as a project's environments. It lives under
 * the XDG config directory instead, written owner-only like .pos (it holds a token).
 */

const DEFAULT_PORTAL_URL = 'https://partners.platformos.com';

const portalsPath = () => {
  if (process.env.POS_PORTALS_FILE) return process.env.POS_PORTALS_FILE;

  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'pos-cli', 'portals.json');
};

const readPortals = () => {
  const file = portalsPath();
  if (!fs.existsSync(file)) return {};

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    throw new Error(`${file} is not valid JSON (${error.message}). Fix or remove it, then run pos-cli portal add again.`);
  }
};

const writePortals = (portals) => {
  const file = portalsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileOwnerOnly(file, JSON.stringify(portals, null, 2));
  logger.Debug(`[portals] Wrote ${file}`);
};

// Own properties only, as for .pos (settings.js): a portal named `constructor` must not
// resolve to something from Object.prototype.
const getPortal = (name) => {
  const portals = readPortals();
  return Object.hasOwn(portals, name) ? portals[name] : undefined;
};

const storePortal = (name, entry) => {
  const portals = readPortals();
  portals[name] = entry;
  writePortals(portals);
};

// Read-modify-write of one entry, keeping every field pos-cli does not know about.
const updatePortal = (name, change) => {
  const portals = readPortals();
  if (!Object.hasOwn(portals, name)) return false;

  portals[name] = change({ ...portals[name] });
  writePortals(portals);
  return true;
};

const removePortal = (name) => {
  const portals = readPortals();
  if (!Object.hasOwn(portals, name)) return false;

  delete portals[name];
  writePortals(portals);
  return true;
};

const missingPortalMessage = (name) =>
  `There is no portal named "${name}" on this machine (${portalsPath()}). ` +
  `Run pos-cli portal add ${name} --url <partner portal url> first.`;

export {
  DEFAULT_PORTAL_URL,
  getPortal,
  missingPortalMessage,
  portalsPath,
  readPortals,
  removePortal,
  storePortal,
  updatePortal
};
