import { writable } from 'svelte/store';

// const isHighlighted = (item) => {
//   item.isHighlighted = !!item.error_type.match(/error/i);
// };

// function createStore() {
//   const { subscribe, get, set, update } = writable({
//     cachedLastId: null,
//     lastId: null,
//     logs: []
//   });

//   return {
//     subscribe,
//     set: obj => set(() => {
//       return {
//         cachedLastId: obj.cachedLastId,
//         lastId: obj.lastId,
//         logs: obj.logs
//       }
//     }),
//     add: obj => update(store => {
//       return {
//         ...obj,
//         logs: store.logs.concat(obj.logs)
//       }
//     })
//   };
// }

export const logs = writable([]);
export const cachedLastId = writable(null);
export const lastId = writable(null);