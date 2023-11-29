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
    const url = 'http://localhost:3333/api/logs';

    const last = args.last ?? null;

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
