import fs from 'fs';
import Gateway from '../proxy.js';
import { fetchSettings } from '../settings.js';
import { isProductionEnvironment, confirmProductionExecution } from '../productionEnvironment.js';

// Resolve the source to execute from either an inline argument or a --file path.
export function resolveSource({ source, file, fileReader = fs }) {
  if (file) {
    if (!fileReader.existsSync(file)) {
      throw new Error(`File not found: ${file}`);
    }
    return fileReader.readFileSync(file, 'utf8');
  }

  return source;
}

// Shared core for the `pos-cli exec *` commands, decoupled from the CLI shell so
// it can be unit tested. It resolves the source, sets up the gateway, enforces
// production confirmation, then delegates the actual API call to `execute`.
//
// Dependencies are injectable via `deps` for testing; the bin passes none and
// gets the real implementations.
export async function runExec({ environment, source, file, program, missingArgName, execute, deps = {} }) {
  const {
    GatewayCtor = Gateway,
    fetchSettingsFn = fetchSettings,
    fileReader = fs,
    isProductionEnvironmentFn = isProductionEnvironment,
    confirmProductionExecutionFn = confirmProductionExecution,
  } = deps;

  const resolved = resolveSource({ source, file, fileReader });
  if (!resolved) {
    throw new Error(`missing required argument '${missingArgName}'`);
  }

  const authData = await fetchSettingsFn(environment, program);
  const gateway = new GatewayCtor(authData);

  if (isProductionEnvironmentFn(environment)) {
    const confirmed = await confirmProductionExecutionFn(environment);
    if (!confirmed) {
      return { cancelled: true };
    }
  }

  const response = await execute(gateway, resolved);
  return { response };
}
