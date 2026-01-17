import crypto from 'crypto';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import pkg from '../../package.json' with { type: "json" };
const version = pkg.version;
import files from '../../lib/files.js';

const getStdout = (cmd) => {
  const stdout = execSync(cmd);
  return stdout.toString().trim();
};

const sha = (str) => crypto.createHash('sha1').update(JSON.stringify(str)).digest('hex');

const getUser = () => {
  const os = process.platform;
  const identifier = sha({
    platform:
      os === 'win32' ? getStdout('systeminfo | findstr /B /C:"OS Name" /C:"OS Version"') : getStdout('uname -a'),
    node: process.version,
    shell: process.env.shell,
  });

  return { identifier };
};

const envs = () => {
  if (process.env.MPKIT_URL) {
    return [process.env.MPKIT_URL]
  };

  const settings = Object(files.getConfig());
  const envs = [];
  for (const env in settings) {
    envs.push(settings[env].url);
  }

  return envs;
};

import { apiRequest } from '../apiRequest.js';

const report = async (message) => {
  return await apiRequest({
    uri: 'https://api.raygun.io/entries',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ApiKey': 'GcFQWxY5X828DCfeLDC3lw'
    },
    body: buildBody(message, getUser(), version)
  });
};

const buildBody = (message,user,version) => {
  return {
    "details": {
      "version": version,
      "client": user,
      "error": {
        "className": "pos-cli-logger",
        "message": message
      },
      "user": user,
      "breadcrumbs": [{
      }]
    }
  }
}

export default report;
