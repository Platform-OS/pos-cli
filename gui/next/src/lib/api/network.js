/*
  handles downloading requests log from the API
*/



const network = {

  // purpose:		downloads requests logs from API
  // arguments:
  // returns:		logs in json format
  // ------------------------------------------------------------------------
  get: async (filters = {}) => {
    // the URL to use to connect to the API, in development or preview mode we are using the default pos-cli gui serve port
    const url = (typeof window !== 'undefined' && window.location.port !== '4173' && window.location.port !== '5173') ? `http://localhost:${parseInt(window.location.port)}/api/logsv2` : 'http://localhost:3333/api/logsv2';


    filters.from = filters.from ?? 0;
    filters.size = filters.size ?? 20;
    filters.stream_name = filters.stream_name ?? 'requests'
    filters.sql = filters.sql ?? `SELECT * FROM requests`;

    // parse the dates from YYYY-MM-DD
    if(filters.start_time){
      // we need end-of-day
      let date = new Date(filters.start_time);
      date.setHours(23, 59, 59);

      filters.end_time = Math.floor(date.getTime() * 1000);
      filters.start_time = Math.floor(date.getTime() - 24 * 60 * 60 * 1000 * 3);
    }


    filters = new URLSearchParams(filters).toString();

    return fetch(`${url}?${filters}`)
      .then(response => {
        if(response.ok){
          return response.json();
        }

        return Promise.reject(response);
      })
      .then(data => {
        return data;
      })
      .catch(error => {
        return { error: error };
      });

  }

};



// exports
// ------------------------------------------------------------------------
export { network };
