/*
  where the pos-cli gui server that the app talks to is running
*/



// purpose:		the address of the pos-cli gui server
// arguments:	path on the server, starting with a slash (string)
// returns:		full url (string)
// ------------------------------------------------------------------------
// the app is served by `pos-cli gui serve` itself, except in development (5173) and
// preview (4173) mode, where it talks to a gui server running on the default port
const serverUrl = (path = '') => {
  const port = typeof window !== 'undefined' ? window.location.port : '';

  if(port && port !== '4173' && port !== '5173'){
    return `http://localhost:${parseInt(port)}${path}`;
  }

  return `http://localhost:3333${path}`;
};



// exports
// ------------------------------------------------------------------------
export { serverUrl };
