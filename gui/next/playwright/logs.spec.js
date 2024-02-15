import { test, expect } from '@playwright/test';


const url = './logs';
const triggerLogUrl = 'https://qa-poscli-gui-ci.staging.oregon.platform-os.com/';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Logs', exact: true}).first().click();

  await expect(page).toHaveTitle('Logs: qa-poscli-gui-ci.staging.oregon.platform-os.com/');

  await expect(page.getByText('No newer logs to show')).toBeVisible();
});


test('viewing logs', async ({ page }) => {
  await page.goto(triggerLogUrl + 'log?message=This+is+a+first+test+log');
  await expect(page.getByText('Registering a log: info')).toBeVisible();

  await page.goto(url);

  await expect(page.getByText('This is a first test log')).toBeVisible();
});


test('pinning a log message and managing pinned logs', async ({ page }) => {
  await page.goto(url);

  const pinButton = page.getByRole('button', { name: 'Pin this log' }).first()

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
  await page.goto(triggerLogUrl + 'log?message=Log+without+error+for+filtering+log+messages+tests');
  await expect(page.getByText('Registering a log: info')).toBeVisible();
  await page.goto(triggerLogUrl + 'log?type=error&message=Error+log+for+filtering+log+messages+tests');
  await expect(page.getByText('Registering a log: error')).toBeVisible();

  await page.goto(url);

  await expect(page.getByText('Log without error for filtering log messages tests')).toBeAttached();
  await expect(page.getByText('Error log for filtering log messages tests')).toBeAttached();

  await page.getByLabel('Filter:').fill('error');

  await expect(page.getByText('Error log for filtering log messages tests')).toBeVisible();
  await expect(page.getByText('Log without error for filtering log messages tests')).toBeHidden();
});


test('clearing logs from the screen', async ({ page }) => {
  await page.goto(triggerLogUrl + 'log?message=Log+for+clearing+logs+from+the+screen+tests');
  await expect(page.getByText('Registering a log: info')).toBeVisible();

  await page.goto(url);

  await expect(page.getByText('Log for clearing logs from the screen tests')).toBeVisible();

  await page.getByRole('button', { name: 'Clear screen' }).click();

  await expect(page.getByText('Log for clearing logs from the screen tests')).toBeHidden();
});
