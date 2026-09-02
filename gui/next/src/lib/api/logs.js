/*
  handles downloading logs from API
*/



const logs = {

  // purpose:		downloads logs from API
  // arguments:	object
  //				last - optional, the id of the last log downloaded
  // returns:		logs in json format
  // ------------------------------------------------------------------------
  get: async (args) => {
    // the URL to use to connect to the API, in development or preview mode we are using the default pos-cli gui serve port
    const url = (typeof window !== 'undefined' && window.location.port !== '4173' && window.location.port !== '5173') ? `http://localhost:${parseInt(window.location.port)}/api/logs` : 'http://localhost:3333/api/logs';

    // 0 is the "from the beginning" sentinel the API expects. Sending `null` here put the
    // literal string "null" in the query, which the server rejects as a non-integer.
    const last = args.last ?? 0;

    return fetch(`${url}?lastId=` + last)
      .then(response => {
        if(response.ok){
          return response.json();
        }

        return Promise.reject(response);
      })
      .then(data => {
        // add a timestamp to each log to know when was it downloaded
        data.logs.forEach(log => {
          log.downloaded_at = Date.now();
        });
        return data;
      })
      .catch(error => {
        return { error: error };
      });

  }

};



// exports
// ------------------------------------------------------------------------
export { logs };
