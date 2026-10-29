import { test, expect } from '@playwright/test';
import { posInstance } from './helpers/posInstance.js';


const url = './logs';
// a freshly registered log reaches the instance's log feed with a delay and the page
// polls for new logs every 3 seconds, so the default 5s is not enough to see it arrive
const logArrival = { timeout: 20000 };


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Logs', exact: true}).first().click();

  await expect(page).toHaveTitle(`Logs: ${posInstance.MPKIT_URL.replace('https://', '')}`);

  await expect(page.getByText('No newer logs to show')).toBeVisible();
});


test('viewing logs', async ({ page }) => {
  await page.goto(posInstance.MPKIT_URL + 'log?message=This+is+a+first+test+log');
  await expect(page.getByText('Registering a log: info')).toBeVisible();

  await page.goto(url);

  await expect(page.getByText('This is a first test log').first()).toBeVisible(logArrival);
});


test('pinning a log message and managing pinned logs', async ({ page }) => {
  await page.goto(url);

  const pinButton = page.getByRole('button', { name: 'Pin this log' }).first();

  // pin log
  await pinButton.click();
  await expect(pinButton).toHaveClass(/active/);

  // open pinned logs sidepanel
  await page.getByRole('button', { name: 'Toggle pinned logs panel' }).click();
  await expect(page.getByRole('button', { name: 'Clear pinned logs' })).toBeVisible();

  // remove a single pinned log
  await page.getByRole('button', { name: 'Remove log from pinned panel' }).click();
  await expect(page.getByRole('button', { name: 'Remove log from pinned panel' })).toBeHidden();

  // pin the log again
  await pinButton.click();
  await expect(page.getByRole('button', { name: 'Remove log from pinned panel' })).toBeVisible();

  // use the 'clear all pinned logs' button
  await page.getByRole('button', { name: 'Clear pinned logs' }).click();
  await expect(page.getByRole('button', { name: 'Remove log from pinned panel' })).toBeHidden();

  // close pinned logs panel
  await page.getByRole('button', { name: 'Toggle pinned logs panel' }).click();
  await expect(page.getByRole('button', { name: 'Clear pinned logs' })).toBeHidden();

});


test('filtering log messages', async ({ page }) => {
  await page.goto(posInstance.MPKIT_URL + 'log?message=Log+of+info+type+for+filtering+log+messages+tests');
  await expect(page.getByText('Registering a log: info')).toBeVisible();
  await page.goto(posInstance.MPKIT_URL + 'log?type=error&message=Error+log+for+filtering+log+messages+tests');
  await expect(page.getByText('Registering a log: error')).toBeVisible();

  await page.goto(url);

  // a retry registers the same messages again, hence first() and counting only the visible matches
  await expect(page.getByText('Log of info type for filtering log messages tests').first()).toBeAttached(logArrival);
  await expect(page.getByText('Error log for filtering log messages tests').first()).toBeAttached(logArrival);

  await page.getByLabel('Filter:').fill('error');

  await expect(page.getByText('Error log for filtering log messages tests').first()).toBeVisible();
  await expect(page.getByText('Log of info type for filtering log messages tests').filter({ visible: true })).toHaveCount(0);
});


test('clearing logs from the screen', async ({ page }) => {
  await page.goto(posInstance.MPKIT_URL + 'log?message=Log+for+clearing+logs+from+the+screen+tests');
  await expect(page.getByText('Registering a log: info')).toBeVisible();

  await page.goto(url);

  await expect(page.getByText('Log for clearing logs from the screen tests').first()).toBeVisible(logArrival);

  await page.getByRole('button', { name: 'Clear screen' }).click();

  await expect(page.getByText('Log for clearing logs from the screen tests').filter({ visible: true })).toHaveCount(0);
});


test('filtering logs while the list is scrolled to the bottom', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(url);
  await expect(page.getByText('No newer logs to show')).toBeVisible();

  // typing a filter hides the footer the page scrolls to, and re-renders the list
  await page.getByLabel('Filter:').fill('a filter that matches no log');
  await expect(page.getByText('No newer logs to show')).toBeHidden();
  await page.getByLabel('Filter:').fill('a filter that matches no log at all');
  await page.waitForTimeout(500);

  expect(errors).toEqual([]);
});


test('showing each log once when the instance answers slower than the page polls', async ({ page }) => {
  const log = (id, message) => ({ id, created_at: new Date().toISOString(), error_type: 'info', message, data: null });
  const first = log('1790000000.000001', 'the first log');
  const second = log('1790000000.000002', 'the log that answered slowly');
  let askedAfterSecond = false;

  // the page polls every 3 seconds; the first poll after the first log takes 4.5 seconds, so the
  // next poll starts while it is still waiting, asks from the same log and is answered first
  let askedAfterFirst = 0;
  await page.route(requestUrl => requestUrl.pathname === '/api/logs', async route => {
    const last = new URL(route.request().url()).searchParams.get('lastId');

    if(last === '0'){
      await route.fulfill({ json: { logs: [first] } });
    } else if(last === first.id){
      if(++askedAfterFirst === 1){
        await new Promise(resolve => setTimeout(resolve, 4500));
      }
      await route.fulfill({ json: { logs: [second] } });
    } else {
      askedAfterSecond = true;
      await route.fulfill({ json: { logs: [] } });
    }
  });

  await page.goto(url);
  await expect(page.getByText('the first log')).toBeVisible();

  // by the time the page asks for logs after the second one, every earlier answer has arrived
  await expect.poll(() => askedAfterSecond, { timeout: 15000 }).toBe(true);
  await expect(page.locator('td.message').getByText('the log that answered slowly')).toHaveCount(1);
});
