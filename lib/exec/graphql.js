import { runExec } from './run.js';

// Parse the --params option into a GraphQL variables object.
// Accepts a JSON object string; returns {} when nothing was provided.
export function parseParams(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return {};
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid --params value: expected a JSON object of variables (${e.message})`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid --params value: expected a JSON object of variables');
  }

  return parsed;
}

// Core logic for `pos-cli exec graphql`.
export async function execGraphql({ environment, query, file, params, program, deps = {} }) {
  const variables = parseParams(params);

  return runExec({
    environment,
    source: query,
    file,
    program,
    missingArgName: 'graphql',
    execute: (gateway, resolvedQuery) => gateway.graph({ query: resolvedQuery, variables }),
    deps,
  });
}
