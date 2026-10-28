/*
  handles downloading logs from API
*/



// purpose:		quotes a value as an SQL string literal
// arguments: the value (string)
// returns:		the literal, with any single quote doubled (string)
// ------------------------------------------------------------------------
const sqlString = (value) => `'${String(value).replaceAll('\'', '\'\'')}'`;


// purpose:		sends a search to the API
// arguments: the request (object)
//				options (object), with fetch to use, such as the one a load function receives
// returns:		logs in json format
// ------------------------------------------------------------------------
const search = (request, options) => {
  const fetchFn = options?.fetch ?? fetch;

  // the URL to use to connect to the API, in development or preview mode we are using the default pos-cli gui serve port
  const url = (typeof window !== 'undefined' && window.location.port !== '4173' && window.location.port !== '5173') ? `http://localhost:${parseInt(window.location.port)}/api/logsv2` : 'http://localhost:3333/api/logsv2';

  return fetchFn(`${url}`, {
    method: 'POST',
    body: JSON.stringify(request),
    headers: {
      'Content-Type': 'application/json'
    }
  })
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
};



const logs = {

  // purpose:		downloads logs from API
  // arguments: filters from the url: page, start_time (YYYY-MM-DD) and message (object)
  // returns:		logs in json format
  // ------------------------------------------------------------------------
  get: async (filters = {}, options) => {
    // the filters come from the url, so only these are read, and the message is written
    // into the query as an escaped string literal
    const size = 20;
    const page = parseInt(filters.page) > 0 ? parseInt(filters.page) - 1 : 0;

    let start_time = 0;
    let end_time = 0;

    // parse the dates from YYYY-MM-DD
    if(filters.start_time){
      // we need end-of-day
      let date = new Date(filters.start_time);
      date.setHours(23, 59, 59);

      end_time = Math.floor(date.getTime() * 1000);
      start_time = Math.floor(date.getTime() - 24 * 60 * 60 * 1000 * 3);
    }

    let sql = 'SELECT * FROM logs';

    if(filters.message){
      const pattern = sqlString(`%${filters.message}%`);
      sql = `SELECT * FROM logs where message ILIKE ${pattern} OR type ILIKE ${pattern} OR options_data_url ILIKE ${pattern}`;
    }

    return search({
      query: {
        sql: sql,
        from: page * size,
        size: size,
        start_time: start_time || 0,
        end_time: end_time || 0,
        track_total_hits: true
      }
    }, options);

  },


  // purpose:		downloads a single log entry from API
  // arguments: the _timestamp of the entry (string of digits)
  // returns:		logs in json format, with the entry as the only hit, or none when the timestamp is not a number
  // ------------------------------------------------------------------------
  getOne: async (timestamp, options) => {
    // the timestamp comes from the url and is written into the query as a number
    if(!/^\d+$/.test(timestamp)){
      return { hits: [] };
    }

    return search({
      query: {
        sql: `select * from logs where _timestamp = ${timestamp}`,
        from: 0,
        size: 1,
        start_time: 0,
        end_time: 0,
        track_total_hits: true
      }
    }, options);

  }

};



// exports
// ------------------------------------------------------------------------
export { logs };
