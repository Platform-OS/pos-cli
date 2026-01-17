import exec from './exec';
import cliPath from './cliPath';

const cleanInstance = async (cwd) => {
  const result = await exec(`${cliPath} data clean --auto-confirm --include-schema`, { cwd, env: process.env });
  if (result.code !== 0) {
    throw new Error(`Failed to clean instance: ${result.stderr}`);
  }
  return result;
};

export { cleanInstance };
