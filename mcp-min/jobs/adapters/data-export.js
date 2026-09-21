import { statusRequest } from '../errors.js';
import { stateOf, statusOf } from './data.js';

/** What the export produced: a link when it was a ZIP, the records themselves otherwise. */
function exported(response, zip) {
  if (zip && response?.zip_file_url) return { zipFileUrl: response.zip_file_url };
  if (!response?.data) return {};
  return {
    exportedData: {
      users: response.data.users?.results || [],
      transactables: response.data.transactables?.results || [],
      models: response.data.models?.results || []
    }
  };
}

export default {
  kind: 'data-export',
  poll: async ({ gateway }, id, flags = {}) => {
    // The handle's flag, never a guess: the wrong reader answers a 503 indistinguishable from
    // "no such job" for an export that finished (see `Gateway.dataExportStatus`).
    const zip = flags.zip === true;
    const response = await statusRequest(() => gateway.dataExportStatus(id, zip), { kind: 'data-export', id });
    const status = statusOf(response);
    const state = stateOf(status, 'data-export');
    return { state, status, result: { zip, ...(state === 'completed' ? exported(response, zip) : {}) } };
  }
};
