import fs from 'fs';
import os from 'os';
import path from 'path';

// dotenv is not loaded here: a test that needs real credentials imports 'dotenv/config' itself,
// which happens before this setup runs. Credentials are not cleared here either, or those tests
// would break.

// Otherwise the MCP server appends to ~/.pos-cli/logs/mcp-min.log, mixing test noise into the log
// someone reads when debugging a real session. A test that wants to read what was logged sets
// this itself.
if (!process.env.MCP_MIN_LOG_FILE) {
  process.env.MCP_MIN_LOG_FILE = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-test-log-')),
    'mcp-min.log'
  );
}

// Silence logger output; tests that assert on logger calls use vi.mocked(logger).Warn etc.
vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Error: vi.fn(), Info: vi.fn(), Warn: vi.fn(), Success: vi.fn() }
}));
