const exec = require('./exec');
const cliPath = require('./cliPath');

/**
 * Clean the instance (remove all data and schemas).
 * Uses MPKIT_URL/MPKIT_TOKEN from environment variables.
 *
 * @param {string} cwd - Working directory for the command
 */
const cleanInstance = async (cwd) => {
  const result = await exec(`${cliPath} data clean --auto-confirm --include-schema`, { cwd, env: process.env });
  if (result.code !== 0) {
    throw new Error(`Failed to clean instance: ${result.stderr}`);
  }
  return result;
};

module.exports = { cleanInstance };
