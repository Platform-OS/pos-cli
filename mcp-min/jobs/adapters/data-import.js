import { statusRequest } from '../errors.js';
import { stateOf, statusOf } from './data.js';

export default {
  kind: 'data-import',
  // `true` is the `csv_import` query parameter the CLI also passes for a ZIP-sourced import
  // (bin/pos-cli-data-import.js); data-import always uploads a ZIP, converting JSON itself.
  poll: async ({ gateway }, id) => {
    const response = await statusRequest(() => gateway.dataImportStatus(id, true), { kind: 'data-import', id });
    const status = statusOf(response);
    return { state: stateOf(status, 'data-import'), status, result: response };
  }
};
