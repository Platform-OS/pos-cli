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
