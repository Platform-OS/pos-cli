const crypto = require('crypto');
const { execSync } = require('child_process');
const raygun = require('raygun');

const { resolve } = require('path');
const { readFileSync } = require('fs');

const version = require('../../package.json').version;

const client = new raygun.Client().init({
  apiKey: 'GcFQWxY5X828DCfeLDC3lw',
  reportUncaughtExceptions: true,
  reportColumnNumbers: true,
});

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

  const json = JSON.parse(readFileSync(resolve(process.cwd(), '.pos'), 'utf8'));

  const envs = [];
  for (const env in json) {
    envs.push(json[env].url);
  }

  return envs;
};

module.exports = (message) => {
  client.user = getUser;
  client.setVersion(version);
  return client.send(message, { envs: envs() });
};
