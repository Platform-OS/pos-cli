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

      res.logs.forEach(item => item.isHighlighted = !!item.error_type.match(/error/i));

      logs.update(logs => logs.concat(res.logs));
      cachedLastId.set(get(lastId));
      lastId.set(res.logs.slice(-1)[0].id);

      scrollToBottom();
    });
}
