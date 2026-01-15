const prompts = require('prompts');
const logger = require('./logger');

/**
 * Checks if an environment name indicates a production environment.
 * Matches environment names containing 'prod' or 'production' (case-insensitive).
 *
 * @param {string} environment - The environment name to check
 * @returns {boolean} True if the environment is considered production
 */
const isProductionEnvironment = (environment) => {
  if (!environment || typeof environment !== 'string') {
    return false;
  }
  const lowerEnv = environment.toLowerCase();
  return lowerEnv.includes('prod')
};

/**
 * Prompts the user to confirm execution on a production environment.
 *
 * @param {string} environment - The environment name
 * @returns {Promise<boolean>} True if the user confirmed, false otherwise
 */
const confirmProductionExecution = async (environment) => {
  logger.Warn(`WARNING: You are executing on a production environment: ${environment}`);
  logger.Warn('This could potentially modify production data or cause unintended side effects.');
  logger.Warn('');

  const response = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: `Are you sure you want to continue executing on ${environment}?`,
    initial: false
  });

  return response.confirmed;
};

module.exports = {
  isProductionEnvironment,
  confirmProductionExecution
};
