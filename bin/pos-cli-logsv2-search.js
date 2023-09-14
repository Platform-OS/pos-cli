#!/usr/bin/env node

const fetchAuthData = require('../lib/settings').fetchSettings,
      program = require('commander'),
      Gateway = require('../lib/proxy'),
      swagger = require('../lib/swagger-client');

program
  .name('pos-cli logsv2 search')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--sql <sql>', 'SQL query to fetch logs')
  .option('--size <size>', 'rows size', 10)
  .option('--from <from>', 'start from', 0)
  .option('--start_time <st>', 'starttime')
  .option('--end_time <et>', 'endtime')
  .option('--json', 'output as json')
  .action((environment) => {
    const authData = fetchAuthData(environment, program);
    const securities = { authorized: { Authorization: authData.token }}

    const getInstance = async () => new Gateway(authData).getInstance()

    const getLogs = async function(){
      const instance = await getInstance();
      const query = {
        agg: {
          histogram: "SELECT histogram(_timestamp, '5 minute') AS key, COUNT(*) AS num FROM query GROUP BY key ORDER BY key"
        },
        query: {
          from: parseInt(program.from),
          size: parseInt(program.size),
          sql: (program.sql || 'select * from logs')
        }
      }
      if (program.start_time) query.query['start_time'] = parseInt(program.start_time)
      if (program.end_time) query.query['end_time'] = parseInt(program.end_time)

      const client = await swagger.client()
      return client.apis.Search.SearchSQL({org_id: instance.uuid}, {requestBody: query, securities})
    }

    const printLogs = (response) => {
      if ( program.json )
        console.log(response.data)
      else
        Object.entries(JSON.parse(response.data).hits).forEach(printLog)
    }
    const printLog = (hit) => console.log(formatHit(hit))
    const formatHit = ([id, hit]) => `[${toDate(hit._timestamp)}] ${hit.type} | ${hit.message}`
    const toDate = (timestamp) => new Date(timestamp / 1000).toLocaleString()

    getLogs().then(printLogs).catch(console.error)
  });

program.parse(process.argv);
