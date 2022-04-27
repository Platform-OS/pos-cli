import { get } from 'svelte/store';
import { logs, cachedLastId, lastId } from './store.js';

const isBrowserTabFocused = () => !document.hidden;

const scrollToBottom = () => {
  setTimeout(() => document.querySelector('footer').scrollIntoView(), 200);
}

export default function () {
  // Make sure first load is always done (middle button click) by checking for cachedLastId
  if (!isBrowserTabFocused() && get(cachedLastId)) return;

  return fetch(`/api/logs?lastId=${get(lastId)}`)
    .then((res) => res.json())
    .then((res) => {
      if (!res.logs.length) return res;

      const newLogs = res.logs.map(item => new LogEntry(item));

      logs.update(logs => logs.concat(newLogs));
      cachedLastId.set(get(lastId));
      lastId.set(newLogs.slice(-1)[0].id);

      scrollToBottom();
    });
}

class LogEntry {
  constructor(data) {
    this.id = data.id || "missing"
    this.message = data.message || "missing"
    this.error_type = data.error_type || "missing"
    this.data = data.data || {}
    this.updated_at = data.updated_at || new Date()

    this.isHighlighted = !!this.error_type.match(/error/i)
  }
}
