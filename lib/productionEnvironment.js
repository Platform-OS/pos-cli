import prompts from 'prompts';
import logger from './logger.js';

const isProductionEnvironment = (environment) => {
  if (!environment || typeof environment !== 'string') {
    return false;
  }
  const lowerEnv = environment.toLowerCase();
  return lowerEnv.includes('prod')
};

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

export { isProductionEnvironment, confirmProductionExecution };
