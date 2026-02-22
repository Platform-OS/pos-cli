import path from 'path';
import { showHelp } from './utils.js';

const helpTool = {
  description: 'Show detailed help for a specific generator',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      generatorPath: { type: 'string', description: 'Path like modules/core/generators/<name>' }
    },
    required: ['generatorPath']
  },
  handler: async (params, ctx = {}) => {
    try {
      const { generatorPath } = params || {};
      const info = showHelp(path.isAbsolute(generatorPath) ? generatorPath : path.join(process.cwd(), generatorPath), ctx.yeomanEnv);
      return info;
    } catch (e) {
      return { ok: false, error: { code: 'GENERATOR_HELP_ERROR', message: String(e?.message || e) } };
    }
  }
};

export default helpTool;
