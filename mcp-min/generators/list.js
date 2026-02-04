import path from 'path';
import { listGeneratorPathsSync, showHelp } from './utils.js';

const listTool = {
  description: 'List available generators discovered under **/generators/*/index.js with required and optional args',
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  handler: async (_params, ctx = {}) => {
    const gens = listGeneratorPathsSync(ctx.globSync);
    const detailed = gens.map((g) => {
      try {
        const p = path.isAbsolute(g.path) ? g.path : path.join(process.cwd(), g.path);
        const info = showHelp(p, ctx.yeomanEnv);
        const required = Array.isArray(info?.args) ? info.args.filter(a => a.required).map(a => a.name) : [];
        const optional = Array.isArray(info?.args) ? info.args.filter(a => !a.required).map(a => a.name) : [];
        return { ...g, required, optional };
      } catch (e) {
        return { ...g, required: [], optional: [] };
      }
    });
    return { generators: detailed };
  }
};

export default listTool;
