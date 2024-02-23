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

    filters.stream_name = filters.stream_name ?? 'requests'

    // parse the dates from YYYY-MM-DD
    if(filters.start_time){
      // we need end-of-day
      let date = new Date(filters.start_time);
      date.setHours(23, 59, 59);

      filters.end_time = Math.floor(date.getTime() * 1000);
      filters.start_time = Math.floor(date.getTime() - 24 * 60 * 60 * 1000 * 3);
    }

    // parse status codes
    if(filters.lb_status_codes){
      filters.lb_status_codes = ` lb_status_code IN (${filters.lb_status_codes}) `;
    }

    let aggregations = {};

    let where = '';
    if(filters.lb_status_codes){
      where = ' WHERE ';
    }

    // request the filters aggregations
    if(!filters.sql){
      aggregations.filters = `SELECT lb_status_code, count(lb_status_code) as count FROM query GROUP BY lb_status_code ORDER BY count DESC LIMIT 20`
    }

    // request the aggregated results
    if(!filters.sql){
      aggregations.results = `SELECT _timestamp, http_request_url, http_request_path, http_request_method, lb_status_code, client, user_agent, request_processing_time, target_processing_time, sent_bytes FROM query ${where} ${filters.lb_status_codes ?? ''} ORDER BY _timestamp DESC`;
    }


    const request = {
      aggs: {
        ...aggregations
      },
      query: {
        sql: filters.sql || `SELECT * FROM ${filters.stream_name}`,
        from: filters.from ?? 0,
        size: filters.size ?? 20,
        start_time: filters.start_time || 0,
        end_time: filters.end_time || 0
      }
    }

    return fetch(`${url}`, {
      method: 'POST',
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json"
      },
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

  }

};



// exports
// ------------------------------------------------------------------------
export { network };
