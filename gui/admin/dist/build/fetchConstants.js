import { a as api } from './api.js';
import { c as constants } from './store2.js';

function fetchConstants() {
  api.getConstants().then((json) => {
    constants.set(json.constants.results);
  });
}

export { fetchConstants as f };
