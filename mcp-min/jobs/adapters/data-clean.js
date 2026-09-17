import { statusRequest } from '../errors.js';
import { stateOf, statusOf } from './data.js';

export default {
  kind: 'data-clean',
  poll: async ({ gateway }, id) => {
    const response = await statusRequest(() => gateway.dataCleanStatus(id), { kind: 'data-clean', id });
    const status = statusOf(response);
    return { state: stateOf(status, 'data-clean'), status, result: response };
  }
};
