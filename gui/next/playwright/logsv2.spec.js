import { test, expect } from '@playwright/test';


const url = './logsv2';
const triggerLogUrl = 'https://qa-poscli-gui-ci.staging.oregon.platform-os.com/';


test('see link on home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Logs v2', exact: true}).first().click();

  await expect(page).toHaveTitle('Logs: ' + triggerLogUrl.replace('https://', ''));
});


test('viewing logs', async ({ page }) => {
  const currentTime = Date.now();

  await page.goto(triggerLogUrl + `log?message=${currentTime}+this+is+a+first+test+log+for+logsv2`);
  await expect(page.getByText('Registering a log: info')).toBeVisible();

  await page.waitForTimeout(5000);

  await page.goto(url);

  await expect(page.getByText(`${currentTime} this is a first test log for logsv2`)).toBeVisible();
});


test('filtering logs to previous date', async ({ page }) => {
  const currentTime = Date.now();

  await page.goto(triggerLogUrl + `log?message=${currentTime}+this+log+should+not+be+visible+after+filtering+the+date`);
  await expect(page.getByText('Registering a log: info')).toBeVisible();

  await page.waitForTimeout(5000);

  await page.goto(url);

  await expect(page.getByText(`${currentTime} this log should not be visible after filtering the date`).first()).toBeVisible();

  const today = new Date();
  const yesterday = today.setDate(today.getDate() - 1);

  await page.getByLabel('Time limit').fill((new Date(yesterday)).toISOString().split('T')[0]);

  await expect(page.getByText(`${currentTime} this log should not be visible after filtering the date`)).toHaveCount(0);
});


test('filtering logs by string', async ({ page }) => {
  const currentTime = Date.now();

  await page.goto(triggerLogUrl + `log?message=Timestamp+log+${currentTime}`);
  await expect(page.getByText('Registering a log: info')).toBeVisible();

  await page.waitForTimeout(5000);

  await page.goto(url);

  await page.getByPlaceholder('Find logs').fill(currentTime.toString());
  await page.getByRole('button', { name: 'Filter logs'}).click();
  
  await expect(page.getByText(`Timestamp log ${currentTime}`).first()).toBeVisible();

  await expect(page.locator('tbody').getByRole('row')).toHaveCount(1);
});


test('opening and closing logs details', async ({ page }) => {
  const currentTime = Date.now();

  await page.goto(triggerLogUrl + `log?message=${currentTime}+log+for+details&type=details`);
  await expect(page.getByText('Registering a log: details')).toBeVisible();

  await page.goto(url);

  await page.getByRole('link', { name: `${currentTime} log for details` }).click();
  await expect(page.getByRole('heading', { name: 'details'})).toBeVisible();
  await expect(page.locator('code').getByText(`${currentTime} log for details`)).toBeVisible();

  // closing
  await page.getByRole('link', { name: 'Close details' }).click();
  await expect(page.getByRole('heading', { name: 'details'})).toBeHidden();
});