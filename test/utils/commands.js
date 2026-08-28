import cli from './exec';

const cleanInstance = async (cwd) => {
  const result = await cli('data clean --auto-confirm --include-schema', { cwd, env: process.env });
  if (result.code !== 0) {
    throw new Error(`Failed to clean instance: ${result.stderr}`);
  }
  return result;
};

export { cleanInstance };
