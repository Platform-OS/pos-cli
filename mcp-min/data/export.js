// platformos.data.export - start data export from platformOS instance
import log from '../log.js';
import { ToolError } from '../tool-error.js';
import { resolveAuth } from '../auth.js';
import { mintFor } from '../jobs/handle.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';

const dataExportTool = {
  description: 'Export the records held on an instance. Returns a job_id to poll with job-status; the finished job carries the records, or a download link when zip is set.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      exportInternalIds: {
        type: 'boolean',
        description: 'Write internal ids instead of external_id.',
        default: false
      },
      zip: {
        type: 'boolean',
        description: 'Produce a ZIP and return a download link.',
        default: false
      }
    }
  },
  handler: async (params, ctx = {}) => {
    log.debug('tool:data-export invoked', { env: params?.env, zip: params?.zip });

    const auth = await resolveAuth(params, ctx);
    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

    const exportInternalIds = !!params.exportInternalIds;
    const isZip = !!params.zip;

    let exportTask;
    try {
      exportTask = await gateway.dataExportStart(exportInternalIds, isZip);
    } catch (e) {
      // A 404 on the endpoint that starts an export means the instance does not offer exports,
      // not that something the caller named is missing, which is how it would otherwise read.
      if (e.statusCode === 404) {
        throw ToolError.instance('NOT_SUPPORTED', 'Data export is not supported by the server.', { statusCode: 404 });
      }
      throw e;
    }

    return {
      id: exportTask.id,
      // The zip flag travels in the handle: reading an export's status needs it, and the
      // agent polling is not the one that chose it.
      job_id: mintFor({ kind: 'data-export', id: exportTask.id, origin: auth.url, flags: { zip: isZip } }),
      instanceStatus: exportTask.status || 'pending',
      isZip
    };
  }
};

export default dataExportTool;
