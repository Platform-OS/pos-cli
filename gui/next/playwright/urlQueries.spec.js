import { test, expect } from '@playwright/test';


// these pages write values from their url into a GraphQL or SQL query; each test opens a
// url whose values would change the query if written in as they are, and checks the query
// that was actually sent


// purpose:   records the bodies of the requests a page sends to an API endpoint
// arguments: the page, the endpoint to watch (string),
//            the response to answer with, or nothing to pass the request on (object)
// returns:   the request bodies, filled as they are sent (array)
// ------------------------------------------------------------------------
const recordRequests = async (page, endpoint, response) => {
  const bodies = [];

  await page.route(`**${endpoint}`, route => {
    bodies.push(route.request().postDataJSON());

    if(response){
      return route.fulfill({ json: response });
    }

    return route.continue();
  });

  return bodies;
};


test('logs v2: treating the message filter from the url as text', async ({ page }) => {
  const requests = await recordRequests(page, '/api/logsv2', { hits: [], total: 0 });
  const message = '\' OR 1=1 OR message ILIKE \'';

  await page.goto(`./logsv2?message=${encodeURIComponent(message)}&sql=${encodeURIComponent('SELECT * FROM secrets')}&stream_name=secrets`);

  await expect(page.locator('[name="message"]')).toHaveValue(message);
  await expect.poll(() => requests.length).toBeGreaterThan(0);

  const sql = requests[0].query.sql;
  expect(sql).toContain('message ILIKE \'%\'\' OR 1=1 OR message ILIKE \'\'%\'');
  expect(sql).not.toContain('secrets');
});


test('logs v2: reading a log id from the url only as a number', async ({ page }) => {
  const requests = await recordRequests(page, '/api/logsv2', { hits: [], total: 0 });

  // a request for the first id, if one is made, is sent once the page has rendered
  await page.goto(`./logsv2/${encodeURIComponent('1 OR 1=1')}`);
  await page.waitForLoadState('networkidle');
  await page.goto('./logsv2/1790008926763906');

  await expect.poll(() => requests.map(request => request.query.sql)).toContain('select * from logs where _timestamp = 1790008926763906');
  expect(requests.map(request => request.query.sql).join('\n')).not.toContain('1=1');
});


test('network: reading the status codes and sorting from the url only as known values', async ({ page }) => {
  const requests = await recordRequests(page, '/api/logsv2', { hits: [], total: 0, aggs: { filters: [], results: [] } });

  const query = new URLSearchParams({
    lb_status_codes: '500,1) OR (1=1',
    order_by: '_timestamp; SELECT 1',
    order: 'DESC; SELECT 2',
    aggregate: 'http_request_path; SELECT 3',
    sql: 'SELECT * FROM secrets'
  });
  await page.goto(`./network?${query}`);

  await expect.poll(() => requests.length).toBeGreaterThan(0);

  const sent = JSON.stringify(requests[0]);
  expect(requests[0].aggs.results).toContain('WHERE lb_status_code IN (500)');
  expect(requests[0].aggs.results).toContain('ORDER BY _timestamp DESC');
  expect(sent).not.toContain('SELECT 1');
  expect(sent).not.toContain('SELECT 2');
  expect(sent).not.toContain('SELECT 3');
  expect(sent).not.toContain('1=1');
  expect(sent).not.toContain('secrets');
});


test('network: reading a request id from the url only as a number', async ({ page }) => {
  const requests = await recordRequests(page, '/api/logsv2', { hits: [], total: 0, aggs: { filters: [], results: [] } });

  // a request for the first id, if one is made, is sent once the page has rendered
  await page.goto(`./network/${encodeURIComponent('1 OR 1=1')}`);
  await page.waitForLoadState('networkidle');
  await page.goto('./network/1790008926763906');

  await expect.poll(() => requests.map(request => request.query.sql)).toContain('select * from requests where _timestamp = 1790008926763906');
  expect(JSON.stringify(requests)).not.toContain('1=1');
});


test('background jobs: treating the type and page from the url as known values', async ({ page }) => {
  const requests = await recordRequests(page, '/api/graph');
  const responses = [];
  page.on('response', async response => {
    if(response.url().endsWith('/api/graph')){
      responses.push(await response.json());
    }
  });

  const query = new URLSearchParams({
    type: 'SCHEDULED } ) { total_pages } other: admin_background_jobs(filter: { type: DEAD',
    page: '1 ) { total_pages } other: admin_background_jobs( page: 2'
  });
  await page.goto(`./backgroundJobs?${query}`);

  await expect.poll(() => responses.length).toBeGreaterThan(0);

  expect(requests[0].query).not.toContain('other:');
  expect(responses[0].errors).toBeUndefined();
});


test('background jobs: treating a job id from the url as text', async ({ page }) => {
  const requests = await recordRequests(page, '/api/graph');
  const id = '1" } ) { total_pages } other: admin_background_jobs(filter: { id: { value: "2';

  await page.goto(`./backgroundJobs/scheduled/${encodeURIComponent(id)}`);

  // written in as it was, the id would end the string early; escaped, it is one string
  await expect.poll(() => requests.map(request => request.query).join('\n')).toContain(`id: { value: ${JSON.stringify(id)} }`);
});
