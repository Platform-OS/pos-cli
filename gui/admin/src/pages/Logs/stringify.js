import hl from 'highlight.js/lib/core';
import jsonLang from 'highlight.js/lib/languages/json';
hl.registerLanguage('json', jsonLang);

import 'highlight.js/styles/googlecode.css';

export default function (msg, o = { formatted: false }) {
  const jsonFormatted = JSON.stringify(JSON.parse(msg), null, 4);
  let html = hl.highlightAuto(msg).value;

  if (o.formatted) {
    html = `<pre>${hl.highlightAuto(jsonFormatted).value}</pre>`;
  }

  return html;
}