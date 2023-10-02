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

    const last = args.last ?? null;

    return fetch('http://localhost:3333/api/logs?lastId=' + last)
      .then(response => {
        if(response.ok){
          return response.json();
        }

        return Promise.reject(response);
      })
      .then(data => {
        // add a timestamp to each log to know when was it downloaded
        data.logs.forEach(log => {
          // the message can be a object parsed to string, but it also can be an object so let's make sure everything is the same
          if(typeof log.message !== 'string'){
            log.message = JSON.stringify(log.message);
          }
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
