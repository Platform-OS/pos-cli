import path from 'path';
import { listGeneratorPathsSync, showHelp } from './utils.js';

const listTool = {
  description: 'List the generators this project provides, with the arguments each one takes.',
  annotations: { readOnlyHint: true },
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  handler: async (_params, ctx = {}) => {
    const gens = listGeneratorPathsSync(ctx.globSync);
    const generators = [];
    // A generator whose help cannot be read used to come back with empty `required`/`optional`,
    // which reads exactly like a generator that takes no arguments. Saying so is the difference
    // between "call this with nothing" and "nobody could tell you what this needs".
    const unreadable = [];

    for (const g of gens) {
      try {
        const p = path.isAbsolute(g.path) ? g.path : path.join(process.cwd(), g.path);
        const info = showHelp(p, ctx.yeomanEnv);
        const required = Array.isArray(info?.args) ? info.args.filter(a => a.required).map(a => a.name) : [];
        const optional = Array.isArray(info?.args) ? info.args.filter(a => !a.required).map(a => a.name) : [];
        generators.push({ ...g, required, optional });
      } catch (e) {
        unreadable.push({ ...g, reason: String(e?.message || e) });
      }
    }

    // Only when there are any: an empty list on every call is a field the model has to read past
    // to learn nothing.
    return { generators, ...(unreadable.length > 0 && { unreadable }) };
  }
};

export default listTool;
