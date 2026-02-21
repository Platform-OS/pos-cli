// setup for ESM/experimental-vm-modules environment compatibility
// Provide global require shim used by some older tests
if (typeof global.require === 'undefined') {
  try {
    const { createRequire } = require('module');
    global.require = createRequire(typeof __filename !== 'undefined' ? __filename : process.cwd());
  } catch (e) {
    // fallback to normal require
    global.require = require;
  }
}

// Provide default envs to stabilize legacy tests that expect MPKIT_* to be defined
process.env.MPKIT_URL = process.env.MPKIT_URL || 'https://example.com';
process.env.MPKIT_EMAIL = process.env.MPKIT_EMAIL || 'pos-cli@example.com';
process.env.MPKIT_TOKEN = process.env.MPKIT_TOKEN || 'test-token';
