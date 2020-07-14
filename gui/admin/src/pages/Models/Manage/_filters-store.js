import { writable } from 'svelte/store';

const createStore = () => {
  const { subscribe, set, update } = writable({});

  return {
    subscribe,
    set,
    update,
    reset: () => {
      set({});
    }
  };
};

export default createStore();