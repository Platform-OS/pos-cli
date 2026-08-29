// One canonical form for a portal or instance base URL.
//
// Several places compare two URLs for equality rather than just fetching them: the dns
// commands guard against pointing a domain at the portal it already lives on, and the
// two-factor session store matches a set of settings back to the .pos entry it came from.
// A trailing slash is a formatting difference, not a different host, so every construction
// path has to normalize identically — otherwise two spellings of one portal compare
// unequal and a stored session stops matching the entry that wrote it.
const normalizeBaseUrl = (url) => String(url || '').replace(/\/+$/, '');

export { normalizeBaseUrl };
