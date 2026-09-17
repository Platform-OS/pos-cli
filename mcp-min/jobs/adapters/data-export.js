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
    const zip = flags.zip === true;
    const response = await statusRequest(() => gateway.dataExportStatus(id, zip), { kind: 'data-export', id });
    const status = statusOf(response);
    const state = stateOf(status, 'data-export');
    return { state, status, result: { zip, ...(state === 'completed' ? exported(response, zip) : {}) } };
  }
};
