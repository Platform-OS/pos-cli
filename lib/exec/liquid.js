import { runExec } from './run.js';

// Core logic for `pos-cli exec liquid`.
export async function execLiquid({ environment, code, file, program, deps = {} }) {
  return runExec({
    environment,
    source: code,
    file,
    program,
    missingArgName: 'code',
    execute: (gateway, content) => gateway.liquid({ content }),
    deps,
  });
}
