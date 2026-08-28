// Which instance is `pos-cli gui serve` pointed at? Every spec that asserts on a page title needs
// it, so it is resolved once here, at import time, with a top-level await: the previous
// fire-and-forget fetch let specs start before MPKIT_URL was filled in, and an unhandled rejection
// took the entire run down with a bare undici stack that named neither this file nor the cause.
//
// 127.0.0.1 rather than "localhost" — see the note in .github/workflows/pull_requests.yml: the two
// names can resolve to different address families, and fetch does not fall back between them.
const INFO_URL = 'http://127.0.0.1:3333/info';

let MPKIT_URL = '';

try {
  const response = await fetch(INFO_URL);
  if (!response.ok) {
    throw new Error(`${INFO_URL} returned HTTP ${response.status}`);
  }
  ({ MPKIT_URL } = await response.json());
} catch (cause) {
  // Fail the run here, naming the missing server, rather than letting every spec fail an opaque
  // title assertion against an empty string.
  throw new Error(
    `Could not read the instance URL from ${INFO_URL}. Is "pos-cli gui serve" running?`,
    { cause }
  );
}

const posInstance = { MPKIT_URL };

export { posInstance };
