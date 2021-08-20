import { writable } from 'svelte/store';

export const logs = writable([]);
export const cachedLastId = writable(null);
export const lastId = writable(null);
export const clearLogs = () => logs.set([]);