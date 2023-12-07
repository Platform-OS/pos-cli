/*
  handles downloading logs from API
*/



const logs = {

  // purpose:		downloads logs from API
  // arguments:
  // returns:		logs in json format
  // ------------------------------------------------------------------------
  get: async (filters = {}) => {
    const url = 'http://localhost:3333/api/logsv2';

    filters.from = filters.from ?? 0;
    filters.size = filters.size ?? 10;
    filters.stream_name = filters.stream_name ?? 'logs'

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
export { logs };
