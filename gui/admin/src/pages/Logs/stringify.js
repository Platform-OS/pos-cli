import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
hljs.registerLanguage('json', json);

import 'highlight.js/styles/googlecode.css';

export default function (msg, o = { pretty: false }) {
  try {
    const json = JSON.stringify(JSON.parse(msg), null, 4);
    return o.pretty ? hljs.highlightAuto(json).value : json;
  } catch (e) {
    return msg;
  }
}
