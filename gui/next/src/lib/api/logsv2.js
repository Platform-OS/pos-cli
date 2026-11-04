/*
  handles downloading logs from API
*/

// imports
// ------------------------------------------------------------------------
import { serverUrl } from '#lib/api/address.js';
import { timeRange } from '#lib/api/timeRange.js';



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

  const url = serverUrl('/api/logsv2');

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

    // the three days up to the end of the chosen one
    const { start_time, end_time } = timeRange(filters.start_time);

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
        start_time: start_time,
        end_time: end_time,
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
