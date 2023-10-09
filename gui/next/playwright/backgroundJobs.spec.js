import { test, expect } from '@playwright/test';


const url = './backgroundJobs';
const triggerLogUrl = 'https://qa-poscli-gui.staging.oregon.platform-os.com/';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Background Jobs', exact: true}).first().click();

  await expect(page).toHaveTitle('Background Jobs | platformOS');
});


test('viewing scheduled background jobs', async ({ page }) => {
  await page.goto(triggerLogUrl + 'background_job');
  await expect(page.getByText('background job scheduled')).toBeVisible();
  await page.waitForTimeout(4000);

  await page.goto(url);

  await expect(page.getByRole('cell', { name: 'scheduled background job' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'high' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'in 10 minutes' }).first()).toBeVisible();
});


test('viewing background job details', async ({ page }) => {
  await page.goto(triggerLogUrl + 'background_job');
  await expect(page.getByText('background job scheduled')).toBeVisible();
  await page.waitForTimeout(4000);

  await page.goto(url);

  await page.getByRole('link', { name: 'scheduled background job' }).first().click();
  await expect(page.getByRole('heading', { name: 'scheduled background job' })).toBeVisible();
  await expect(page.locator('span.label .property').first()).toBeVisible();

  // close details panel
  await page.getByRole('link', { name: 'Close details' }).click();
  await expect(page.getByRole('heading', { name: 'scheduled background job' })).toBeHidden();
});


test('deleting scheduled background job', async ({ page }) => {
  await page.goto(triggerLogUrl + 'background_job_to_delete');
  await expect(page.getByText('background job scheduled')).toBeVisible();
  await page.waitForTimeout(4000);

  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to delete this background job?');
    await dialog.accept();
  });

  await page.goto(url);

  const job = await page.locator('tr:has-text("background job to delete")');

  await page.locator('tr:has-text("background job to delete")').getByRole('button', { name: 'More options' }).click();
  await page.locator('tr:has-text("background job to delete")').getByRole('button', { name: 'Delete background job' }).click();

  await expect(page.locator('tr:has-text("background job to delete")')).toBeHidden();
});
