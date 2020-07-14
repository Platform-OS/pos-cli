import { writable } from 'svelte/store';
import api from "@/lib/api";

const createStore = () => {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    set,
    update,
    addModel: (model) => {
      return update(models => [...models, model]);
    },
    refreshModels: (schemaId) => {
      return Promise.all([
        api.getModels({ schemaId }),
        api.getModels({ schemaId, deleted: true })
      ]).then((results) => {
        set([...results[0], ...results[1]]);
      });
    }
  };
};

export default createStore();
