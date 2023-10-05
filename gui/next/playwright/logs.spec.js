import { test, expect } from '@playwright/test';


const url = './logs';
const triggerLogUrl = 'https://qa-poscli-gui.staging.oregon.platform-os.com/';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Logs', exact: true}).first().click();

  await expect(page).toHaveTitle('Logs | platformOS');

  await expect(page.getByText('No newer logs to show')).toBeVisible();
});


test('viewing logs', async ({ page }) => {
  await page.goto(triggerLogUrl + 'log');

  await page.goto(url);

  await expect(page.getByText('This is a test log').first()).toBeVisible();
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
  await page.goto(triggerLogUrl + 'log');
  await expect(page.getByText('Registering a log')).toBeVisible();
  await page.goto(triggerLogUrl + 'log_error');
  await expect(page.getByText('Registering an error log')).toBeVisible();

  await page.goto(url);

  await expect(page.getByText('This is a test log').first()).toBeVisible();
  await expect(page.getByText('This is an error log').first()).toBeVisible();

  await page.getByLabel('Filter:').fill('error');

  await expect(page.getByText('This is an error log').first()).toBeVisible();
  await expect(page.getByText('This is a test log').first()).toBeHidden();
});


test('clearing logs from the screen', async ({ page }) => {
  await page.goto(triggerLogUrl + 'log');

  await page.goto(url);

  await expect(page.getByText('This is a test log').first()).toBeVisible();

  await page.getByRole('button', { name: 'Clear screen' }).click();

  await expect(page.getByText('This is a test log').first()).toBeHidden();
});
