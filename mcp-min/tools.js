// Define tools for the minimal MCP server
import log from './log.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import files from '../lib/files.js';

// Load tool configuration (descriptions and enabled/disabled state)
// MCP_TOOLS_CONFIG env var overrides the bundled config
const __dirname = dirname(fileURLToPath(import.meta.url));
let toolsConfig = { tools: {} };
const configPath = process.env.MCP_TOOLS_CONFIG || join(__dirname, 'tools.config.json');
try {
  toolsConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  log.debug('tools config loaded', { path: configPath, tools: Object.keys(toolsConfig.tools || {}).length });
} catch (err) {
  log.debug('tools config not found or invalid, using defaults', { path: configPath, error: String(err) });
}

// Keep tools.js lean by extracting complex tools into modules
import singleFileTool from './sync/single-file.js';
import fetchLogsTool from './logs/fetch.js';
import execLiquidTool from './liquid/exec.js';
import streamLogsTool from './logs/stream.js';
import execGraphqlTool from './graphql/exec.js';
import generatorsListTool from './generators/list.js';
import generatorsHelpTool from './generators/help.js';
import generatorsRunTool from './generators/run.js';

// migrations tools
import migrationsListTool from './migrations/list.js';
import migrationsGenerateTool from './migrations/generate.js';
import migrationsRunTool from './migrations/run.js';

// deploy tools
import deployStartTool from './deploy/start.js';
import deployStatusTool from './deploy/status.js';
import deployWaitTool from './deploy/wait.js';

// data tools
import dataImportTool from './data/import.js';
import dataImportStatusTool from './data/import-status.js';
import dataExportTool from './data/export.js';
import dataExportStatusTool from './data/export-status.js';
import dataCleanTool from './data/clean.js';
import dataCleanStatusTool from './data/clean-status.js';
import dataValidateTool from './data/validate-tool.js';

// tests tools
import testsRunTool from './tests/run.js';
import testsRunAsyncTool from './tests/run-async.js';
import testsRunAsyncResultTool from './tests/run-async-result.js';

// check tools
import checkTool from './check/index.js';
import checkRunTool from './check/run.js';

// uploads tool
import uploadsPushTool from './uploads/push.js';

// constants tools
import constantsListTool from './constants/list.js';
import constantsSetTool from './constants/set.js';
import constantsUnsetTool from './constants/unset.js';

// portal tools
import instanceCreateTool from './portal/instance-create.js';
import partnersListTool from './portal/partners-list.js';
import partnerGetTool from './portal/partner-get.js';
import endpointsListTool from './portal/endpoints-list.js';
import envAddTool from './portal/env-add.js';

const tools = {

  // list-envs tool based on pos-cli-env list
  'envs-list': {
    description: 'List configured environments from .pos (name and url)',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async (_params, ctx) => {
      const startedAt = new Date().toISOString();
      log.debug('tool:list-envs invoked', { transport: ctx?.transport });
      const settingsMap = Object(files.getConfig());
      const names = Object.keys(settingsMap);
      const environments = names.map((name) => ({ name, url: settingsMap[name]?.url }));
      return {
        ok: true,
        data: { environments },
        meta: { startedAt, finishedAt: new Date().toISOString() }
      };
    }
  },

  // logs.fetch: one-shot batch fetch of logs (uses Gateway.logs)
  'logs-fetch': fetchLogsTool,

  // liquid.exec: render Liquid template remotely via /liquid_exec
  'liquid-exec': execLiquidTool,

  // logs.stream: real-time streaming via polling
  // 'logs-stream': streamLogsTool,

  // graphql.exec: run GraphQL query/mutation via /api/graph
  'graphql-exec': execGraphqlTool,

  // generators
  'generators-list': generatorsListTool,
  'generators-help': generatorsHelpTool,
  'generators-run': generatorsRunTool,

  // migrations
  'migrations-list': migrationsListTool,
  'migrations-generate': migrationsGenerateTool,
  'migrations-run': migrationsRunTool,

  // deploy
  'deploy-start': deployStartTool,
  'deploy-status': deployStatusTool,
  'deploy-wait': deployWaitTool,

  // data
  'data-import': dataImportTool,
  'data-import-status': dataImportStatusTool,
  'data-export': dataExportTool,
  'data-export-status': dataExportStatusTool,
  'data-clean': dataCleanTool,
  'data-clean-status': dataCleanStatusTool,
  'data-validate': dataValidateTool,

  // tests
  'unit-tests-run': testsRunTool,
  'tests-run-async': testsRunAsyncTool,
  'tests-run-async-result': testsRunAsyncResultTool,

  // check: run platformos-check linter
  'check': checkTool,
  'check-run': checkRunTool,

  // sync.singleFile: upload or delete a single file to platformOS instance
  'sync-file': singleFileTool,

  // uploads: push property uploads ZIP to instance
  'uploads-push': uploadsPushTool,

  // constants: manage instance constants
  'constants-list': constantsListTool,
  'constants-set': constantsSetTool,
  'constants-unset': constantsUnsetTool,

  // portal: Partner Portal instance management
  'instance-create': instanceCreateTool,
  'partners-list': partnersListTool,
  'partner-get': partnerGetTool,
  'endpoints-list': endpointsListTool,
  'env-add': envAddTool
};

// Apply configuration: override descriptions and filter disabled tools
function applyConfig(allTools, config) {
  const result = {};
  for (const [name, tool] of Object.entries(allTools)) {
    const cfg = config.tools?.[name];

    // Skip disabled tools
    if (cfg && cfg.enabled === false) {
      log.debug('tool disabled by config', { name });
      continue;
    }

    // Override description from config if present
    if (cfg && cfg.description) {
      result[name] = { ...tool, description: cfg.description };
    } else {
      result[name] = tool;
    }
  }
  return result;
}

const configuredTools = applyConfig(tools, toolsConfig);

export default configuredTools;
