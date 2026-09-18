import fs from 'fs';
import os from 'os';
import path from 'path';

// Do NOT load dotenv here automatically
// Tests that need real credentials should import 'dotenv/config' at the top of their file
// Tests that don't need credentials will work without loading dotenv

// Note: We do NOT clear credentials here because:
// 1. Integration tests import 'dotenv/config' at the top of their file (before this setup runs)
// 2. Unit tests don't import dotenv, so they won't have credentials
// 3. Clearing credentials here would break integration tests

// If a unit test accidentally has credentials set (e.g., from environment), it should handle that in the test itself

// The MCP server appends to ~/.pos-cli/logs/mcp-min.log unless told otherwise, and a test that
// exercises a tool logs there as the developer's own runs do — a 4 MB file of test noise mixed
// into the log someone reads when debugging a real session. Each test process gets its own file
// in a temp directory instead; a test that wants to read what was logged sets this itself.
if (!process.env.MCP_MIN_LOG_FILE) {
  process.env.MCP_MIN_LOG_FILE = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-test-log-')),
    'mcp-min.log'
  );
}

// Silence logger output across all unit tests. Tests that want to assert on
// logger calls can import the mock and use vi.mocked(logger).Warn etc.
vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Error: vi.fn(), Info: vi.fn(), Warn: vi.fn(), Success: vi.fn() }
}));
