/*
  the GUI is served as static files by `pos-cli gui serve` and runs only in the browser
  (adapter-static with an index.html fallback), so nothing is rendered on a server and
  every load function runs in the browser
*/


export const ssr = false;
