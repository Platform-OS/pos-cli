// Credential utilities for tests
// Provides three modes: real, example, and none

// Note: Tests that need real credentials should import 'dotenv/config' at the top of their file
// This loads .env file into process.env before any test code runs

// Example/test credentials (for tests that need valid-looking but fake credentials)
const exampleCredentials = {
  MPKIT_URL: 'https://example.com',
  MPKIT_TOKEN: 'test-token',
  MPKIT_EMAIL: 'test@example.com'
};

// No credentials (for tests that check if environment is required)
const noCredentials = {
  MPKIT_URL: undefined,
  MPKIT_TOKEN: undefined,
  MPKIT_EMAIL: undefined
};

// Apply credentials to process.env
const applyCredentials = (creds) => {
  if (creds) {
    process.env.MPKIT_URL = creds.MPKIT_URL;
    process.env.MPKIT_TOKEN = creds.MPKIT_TOKEN;
    process.env.MPKIT_EMAIL = creds.MPKIT_EMAIL;
  } else {
    delete process.env.MPKIT_URL;
    delete process.env.MPKIT_TOKEN;
    delete process.env.MPKIT_EMAIL;
  }
};

const hasRealCredentials = () => {
  return !!(process.env.MPKIT_URL && process.env.MPKIT_TOKEN && process.env.MPKIT_EMAIL && !process.env.MPKIT_URL.includes('example.com'));
};

const requireRealCredentials = () => {
  if (!hasRealCredentials()) {
    throw new Error('Missing real platformOS credentials (MPKIT_URL, MPKIT_TOKEN, MPKIT_EMAIL). Load .env file to run these tests.');
  }
};

// Save and restore credentials (for tests that need to switch between different credential sets)
const saveCredentials = () => ({
  MPKIT_URL: process.env.MPKIT_URL,
  MPKIT_TOKEN: process.env.MPKIT_TOKEN,
  MPKIT_EMAIL: process.env.MPKIT_EMAIL
});

const restoreCredentials = (saved) => {
  applyCredentials(saved);
};

export { exampleCredentials, noCredentials, applyCredentials, hasRealCredentials, requireRealCredentials, saveCredentials, restoreCredentials };
