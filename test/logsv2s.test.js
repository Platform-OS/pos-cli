/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const fs = require('fs');
const path = require('path');
// const HTTP = require('../lib/logsv2/http');

require('dotenv').config();

const swagger = require('../lib/swagger-client');
const HTTP = require('../lib/logsv2/http');

jest.mock('../lib/logsv2/http');

const toDate = (timestamp) => { return new Date(timestamp / 1000).toLocaleString() };

describe('Happy path', () => {
  test('search', async () => {

    const expected = {
      hits: [{ _timestamp: "1701428187696722", message: "hello", type: "info" }]
    }

    HTTP.get = jest.fn(x => Promise.resolve(expected));

    const logs = []
    console.log = jest.fn(x => { logs.push(x) });

    const params = {
      // key: '174',
    }

    const client = await swagger.SwaggerProxy.client();
    const response = await client.searchAround(params);

    console.log(response);

    expect(HTTP.get).toBeCalledTimes(1);
    expect(console.log).toBeCalledTimes(1);

    swagger.search.printLogs(response, params.key);
    expect(logs).toContain(`[${toDate("1701428187696722")}] 1701428187696722 info | hello`)

    expect(response).toEqual(expected);
  });
})
