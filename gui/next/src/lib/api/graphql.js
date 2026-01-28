/*
  an interface to call graphql queries against the instance
*/



// purpose:		run a graphql query
// arguments:	body of the query (string)
// returns:		data returned from the database (object)
// ------------------------------------------------------------------------
const graphql = (body) => {
  // the URL to use to connect to the API, in development or preview mode we are using the default pos-cli gui serve port
  const url = (typeof window !== 'undefined' && window.location.port !== '4173' && window.location.port !== '5173') ? `http://localhost:${parseInt(window.location.port)}/api/graph` : 'http://localhost:3333/api/graph';

  return fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify(body)
  })
    .then((res) => res.json())
    .then((res) => {
      if(res.errors) {
        res.errors.forEach(error => {
          console.log(body.query);
          console.info(error);
        });
        return res;
      }

      return res && res.data;
    });
};



// exports
// ------------------------------------------------------------------------
export { graphql };
