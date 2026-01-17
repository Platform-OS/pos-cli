const hasRealCredentials = () => {
  return process.env.MPKIT_URL &&
         process.env.MPKIT_TOKEN &&
         !process.env.MPKIT_URL.includes('example.com');
};

const requireRealCredentials = () => {
  if (!hasRealCredentials()) {
    throw new Error('Missing real platformOS credentials (MPKIT_URL, MPKIT_TOKEN). Load .env file to run these tests.');
  }
};

module.exports = { hasRealCredentials, requireRealCredentials };
