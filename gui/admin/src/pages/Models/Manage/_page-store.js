import { writable } from 'svelte/store';

const createStore = () => {
  const { subscribe, set, update } = writable({ page: 1 });

  return {
    subscribe,
    set,
    update,
    setPaginationData: ({ total_entries, total_pages }) => {
      update(s => {
        return { ...s, total_entries, total_pages };
      });
    },
    setSchemaId: id => {
      update(s => ({ ...s, schemaId: id }))
    },
    reset: () => update(s => ({ ...s, page: 1 })),
    increment: () => {
      update(s => {
        const page = s.page + 1;
        return { ...s, page };
      });
    },
    decrement: () => {
      update(s => {
        const page = s.page - 1 || 1;
        return { ...s, page };
      });
    }
  };
};

export default createStore();