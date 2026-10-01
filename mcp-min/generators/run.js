import path from 'path';
import { runGenerator } from './utils.js';
import { ToolError } from '../tool-error.js';
import { generatorPathProperty } from '../schemas/generators.js';

const runTool = {
  description: 'Run a generator, writing the files it produces into the project.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      generatorPath: generatorPathProperty,
      args: { type: 'array', items: { type: 'string' }, description: 'Positional arguments, in the order the generator expects.' },
      options: { type: 'object', additionalProperties: true, description: 'Named options, as key and value.' },
      requireArgs: { type: 'boolean', description: 'Refuse to run when a required argument is missing.', default: true }
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
            throw ToolError.input(
              'MISSING_REQUIRED_ARGUMENTS',
              `Missing required args: ${requiredNames.join(', ')}`,
              { required: requiredNames }
            );
          }
        }
      } catch (e) {
        // A generator that is not there, or arguments that are missing, is the answer — not
        // something to run past. Anything else help raises is introspection trouble, and running
        // the generator anyway is the older, more useful behaviour.
        if (e instanceof ToolError) throw e;
      }
    }

    const result = await runGenerator(resolvedPath, args, options, ctx.yeomanEnv);
    return { result };
  }
};

export default runTool;
