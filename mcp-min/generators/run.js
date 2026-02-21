import path from 'path';
import { runGenerator } from './utils.js';

const runTool = {
  description: 'Run a yeoman generator by path with arguments and options',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      generatorPath: { type: 'string' },
      args: { type: 'array', items: { type: 'string' }, description: 'Positional arguments passed to generator (order matters)' },
      options: { type: 'object', additionalProperties: true, description: 'Options passed to generator (like --name=value)' },
      requireArgs: { type: 'boolean', description: 'If true, validate that required generator args are provided', default: true }
    },
    required: ['generatorPath', 'args']
  },
  handler: async (params, ctx = {}) => {
    const { generatorPath, args = [], options = {}, requireArgs = true } = params || {};
    const resolvedPath = path.isAbsolute(generatorPath) ? generatorPath : path.join(process.cwd(), generatorPath);

    // If validation requested, introspect required args using showHelp and enforce presence
    if (requireArgs) {
      try {
        const info = (await import('./help.js')).default;
        const helpInfo = await info.handler({ generatorPath: resolvedPath }, { yeomanEnv: ctx.yeomanEnv });
        if (helpInfo && helpInfo.args && Array.isArray(helpInfo.args)) {
          const requiredNames = helpInfo.args.filter(a => a.required).map(a => a.name);
          if (requiredNames.length > 0 && (!Array.isArray(args) || args.length < requiredNames.length)) {
            return { success: false, error: { code: 'MISSING_REQUIRED_ARGUMENTS', message: `Missing required args: ${requiredNames.join(', ')}` }, required: requiredNames };
          }
        }
      } catch (e) {
        // Ignore help errors; fallback to running
      }
    }

    const result = await runGenerator(resolvedPath, args, options, ctx.yeomanEnv);
    return { success: true, result };
  }
};

export default runTool;
