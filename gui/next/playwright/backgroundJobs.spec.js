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

  await page.goto(url);

  await expect(page.getByRole('cell', { name: 'scheduled background job' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'high' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'in 10 minutes' }).first()).toBeVisible();
});


test('viewing background job details', async ({ page }) => {
  await page.goto(triggerLogUrl + 'background_job');

  await page.goto(url);

  await page.getByRole('link', { name: 'scheduled background job' }).first().click();
  await expect(page.getByRole('heading', { name: 'scheduled background job' })).toBeVisible();
  await expect(page.locator('span.label .property').first()).toBeVisible();

  // close details panel
  await page.getByRole('link', { name: 'Close details' }).click();
  await expect(page.getByRole('heading', { name: 'scheduled background job' })).toBeHidden();
});


test('deleting scheduled background job', async ({ page }) => {
  await page.goto(triggerLogUrl + 'background_job');

  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to delete this background job?');
    await dialog.accept();
  });

  await page.goto(url);

  page.getByRole('cell', { name: 'in 10 minutes' });

  await page.getByRole('button', { name: 'More options' }).last().click();
  await page.getByRole('button', { name: 'Delete background job' }).last().click();

  await expect(page.getByRole('cell', { name: 'in 10 minutes' })).toBeHidden();
});
