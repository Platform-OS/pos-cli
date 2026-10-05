import path from 'path';
import { showHelp } from './utils.js';
import { ToolError } from '../tool-error.js';
import { generatorPathProperty } from '../schemas/generators.js';

// What yeoman raises when the path names no generator. Classified rather than pre-checked on the
// filesystem, so that a caller supplying its own environment is still answered by that environment.
const MISSING = /cannot find module|no such file|ENOENT/i;

const helpTool = {
  description: 'Show the arguments and options one generator takes.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      generatorPath: generatorPathProperty
    },
    required: ['generatorPath']
  },
  handler: async (params, ctx = {}) => {
    const { generatorPath } = params || {};
    const resolved = path.isAbsolute(generatorPath) ? generatorPath : path.join(process.cwd(), generatorPath);

    try {
      return showHelp(resolved, ctx.yeomanEnv);
    } catch (e) {
      const message = String(e?.message || e);
      // A path that names nothing is the caller's to fix; anything else is trouble reading a
      // generator that is there, which runTool reports as our defect.
      if (MISSING.test(message)) {
        throw ToolError.not_found('GENERATOR_NOT_FOUND', `No generator at ${generatorPath}: ${message}`, { generatorPath });
      }
      throw e;
    }
  }
};

export default helpTool;
