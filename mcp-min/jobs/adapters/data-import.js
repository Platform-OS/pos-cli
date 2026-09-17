import { statusRequest } from '../errors.js';
import { stateOf, statusOf } from './data.js';

export default {
  kind: 'data-import',
  // `true`: data-import always uploads a ZIP, even for JSON it converted itself.
  poll: async ({ gateway }, id) => {
    const response = await statusRequest(() => gateway.dataImportStatus(id, true), { kind: 'data-import', id });
    const status = statusOf(response);
    return { state: stateOf(status, 'data-import'), status, result: response };
  }
};
