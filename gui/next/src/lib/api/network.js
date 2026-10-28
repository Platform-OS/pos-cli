/*
  handles downloading requests log from the API
*/



// the columns the results can be sorted by, for plain and for aggregated results (array)
const orderColumns = ['_timestamp', 'http_request_path', 'target_processing_time'];
const aggregatedOrderColumns = ['count', 'http_request_path', 'median_target_processing_time'];


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



const network = {

  // purpose:		downloads requests logs from API
  // arguments: filters from the url: start_time (YYYY-MM-DD), lb_status_codes (comma separated),
  //            aggregate ('http_request_path'), order_by and order ('ASC' or 'DESC') (object)
  // returns:		logs in json format
  // ------------------------------------------------------------------------
  get: async (filters = {}, options) => {
    // the filters come from the url and are written into the query text, so only these are
    // read: the status codes are numbers, the sorting one of the known columns and directions
    const aggregated = filters.aggregate === 'http_request_path';

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

    // parse status codes
    const statusCodes = (filters.lb_status_codes ?? '').split(',').filter(code => /^\d{3}$/.test(code));
    const where = statusCodes.length ? ` WHERE lb_status_code IN (${statusCodes.join(',')}) ` : '';

    // parse sorting
    const columns = aggregated ? aggregatedOrderColumns : orderColumns;
    const orderBy = columns.includes(filters.order_by) ? filters.order_by : columns[0];
    const direction = filters.order === 'ASC' ? 'ASC' : 'DESC';
    const order = ` ORDER BY ${orderBy} ${direction} `;

    const aggregations = {
      // the filters aggregations
      filters: 'SELECT lb_status_code, count(lb_status_code) as count FROM query GROUP BY lb_status_code ORDER BY count DESC',
      // the aggregated results
      results: aggregated
        ? `SELECT http_request_path, count(http_request_path) as count, http_request_method, approx_percentile_cont(target_processing_time, 0.5) as median_target_processing_time, avg(target_processing_time) as avg_target_processing_time, min(target_processing_time) as min_target_processing_time, max(target_processing_time) as max_target_processing_time FROM query ${where} GROUP BY http_request_path, http_request_method ${order}`
        : `SELECT _timestamp, http_request_url, http_request_path, http_request_method, lb_status_code, client, user_agent, request_processing_time, target_processing_time, sent_bytes FROM query ${where} ${order} LIMIT 150`
    };

    return search({
      aggs: aggregations,
      query: {
        sql: 'SELECT * FROM requests',
        from: 0,
        size: 150,
        start_time: start_time,
        end_time: end_time
      }
    }, options);

  },


  // purpose:		downloads a single request log from API
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
        sql: `select * from requests where _timestamp = ${timestamp}`,
        from: 0,
        size: 1,
        start_time: 0,
        end_time: 0
      }
    }, options);

  }

};



// exports
// ------------------------------------------------------------------------
export { network };
