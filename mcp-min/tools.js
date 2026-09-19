/**
 * Every tool the MCP server can expose, in the order clients see them. Only the registry: what a
 * server actually serves is resolved once at startup in tool-selection.js.
 *
 * `annotations: { readOnlyHint: true }` promises the tool changes nothing, locally or on the
 * instance — clients may run those without asking. The reviewed set is pinned by
 * `__tests__/tool-annotations.test.js`.
 */
import log from './log.js';
import files from '../lib/files.js';

import singleFileTool from './sync/single-file.js';
import fetchLogsTool from './logs/fetch.js';
import execLiquidTool from './liquid/exec.js';
import execGraphqlTool from './graphql/exec.js';
import generatorsListTool from './generators/list.js';
import generatorsHelpTool from './generators/help.js';
import generatorsRunTool from './generators/run.js';

import migrationsListTool from './migrations/list.js';
import migrationsGenerateTool from './migrations/generate.js';
import migrationsRunTool from './migrations/run.js';

import jobStatusTool from './jobs/status.js';

import deployStartTool from './deploy/start.js';
import deployDryRunTool from './deploy/dry-run.js';

import dataImportTool from './data/import.js';
import dataExportTool from './data/export.js';
import dataCleanTool from './data/clean.js';
import dataValidateTool from './data/validate-tool.js';

import testsRunTool from './tests/run.js';
import testsRunAsyncTool from './tests/run-async.js';

import checkRunTool from './check/run.js';

import uploadsPushTool from './uploads/push.js';

import constantsListTool from './constants/list.js';
import constantsSetTool from './constants/set.js';
import constantsUnsetTool from './constants/unset.js';

import instanceCreateTool from './portal/instance-create.js';
import partnersListTool from './portal/partners-list.js';
import partnerGetTool from './portal/partner-get.js';
import endpointsListTool from './portal/endpoints-list.js';
import envAddTool from './portal/env-add.js';

const tools = {
  'envs-list': {
    description: 'List the environments in .pos, with the instance URL of each.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {}
    },
    handler: async (_params, ctx) => {
      log.debug('tool:list-envs invoked', { transport: ctx?.transport });
      const settingsMap = Object(files.getConfig());
      const environments = Object.keys(settingsMap).map((name) => ({ name, url: settingsMap[name]?.url }));
      return { environments };
    }
  },

  'logs-fetch': fetchLogsTool,
  'liquid-exec': execLiquidTool,
  'graphql-exec': execGraphqlTool,

  'generators-list': generatorsListTool,
  'generators-help': generatorsHelpTool,
  'generators-run': generatorsRunTool,

  'migrations-list': migrationsListTool,
  'migrations-generate': migrationsGenerateTool,
  'migrations-run': migrationsRunTool,

  // The status of anything deploy-start, data-* or tests-run-async started.
  'job-status': jobStatusTool,

  'deploy-dry-run': deployDryRunTool,
  'deploy-start': deployStartTool,

  'data-import': dataImportTool,
  'data-export': dataExportTool,
  'data-clean': dataCleanTool,
  'data-validate': dataValidateTool,

  'unit-tests-run': testsRunTool,
  'tests-run-async': testsRunAsyncTool,

  'check-run': checkRunTool,

  'sync-file': singleFileTool,
  'uploads-push': uploadsPushTool,

  'constants-list': constantsListTool,
  'constants-set': constantsSetTool,
  'constants-unset': constantsUnsetTool,

  // Partner Portal
  'instance-create': instanceCreateTool,
  'partners-list': partnersListTool,
  'partner-get': partnerGetTool,
  'endpoints-list': endpointsListTool,
  'env-add': envAddTool
};

// A Map, not an object literal: lookups by an untrusted name must not reach Object.prototype
// (`constructor`, `toString`…), and iteration order is the registry order clients see.
const registry = new Map(Object.entries(tools));

export default registry;
