#!/usr/bin/env node

// stdout is reserved for MCP JSON-RPC - never write to it in this file.
import path from 'path';
import logger from '../lib/logger.js';

const loadSupervisor = async () => {
  try {
    return await import('@platformos/platformos-mcp-supervisor');
  } catch {
    await logger.Error(
      'The @platformos/platformos-mcp-supervisor package is not installed.\n' +
        'Install it with: npm install -g @platformos/pos-cli',
      { notify: false }
    );
  }
};

// same precedence as the upstream bin: --project > POS_SUPERVISOR_PROJECT_DIR > cwd
const args = process.argv.slice(2);
const projectFlagIndex = args.indexOf('--project');
const projectDir = path.resolve(
  (projectFlagIndex !== -1 && args[projectFlagIndex + 1]) ||
    args.find((arg) => arg.startsWith('--project='))?.slice('--project='.length) ||
    process.env.POS_SUPERVISOR_PROJECT_DIR ||
    process.cwd()
);

const supervisor = await loadSupervisor();
const startServer = supervisor.startServer ?? supervisor.default?.startServer;
await startServer({ projectDir });
