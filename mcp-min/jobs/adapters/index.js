/**
 * One adapter per job kind: `poll(deps, id, flags)` → `{ state, status, result, error? }`, where
 * `state` is 'running' | 'completed' | 'failed'. Everything kind-specific about reading a status
 * lives behind this — `job-status` itself only resolves credentials and formats.
 *
 * `status` is the instance's own word, kept under the platform's name here because that is what an
 * adapter reads off the wire; `job-status` publishes it as `instanceStatus`, so that a caller
 * cannot read it as a second spelling of `state`.
 */
import deploy from './deploy.js';
import dataImport from './data-import.js';
import dataExport from './data-export.js';
import dataClean from './data-clean.js';
import { JOB_KINDS } from '../handle.js';

const adapters = new Map([deploy, dataImport, dataExport, dataClean].map(a => [a.kind, a]));

// A kind a handle can carry but nothing can read would be minted and then never answerable.
const missing = JOB_KINDS.filter(kind => !adapters.has(kind));
if (missing.length > 0) throw new Error(`job kinds with no adapter: ${missing.join(', ')}`);

export default adapters;
