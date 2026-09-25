import { statusRequest } from '../errors.js';
import { stateOf, statusOf } from './data.js';

export default {
  kind: 'data-import',
  // Always true: `data-import` always uploads a ZIP, and without the flag the instance answers a
  // 503 that is indistinguishable from "no such job" (see `Gateway.dataImportStatus`).
  poll: async ({ gateway }, id) => {
    const response = await statusRequest(() => gateway.dataImportStatus(id, true), { kind: 'data-import', id });
    const status = statusOf(response);
    return { state: stateOf(status, 'data-import'), status, result: response };
  }
};
