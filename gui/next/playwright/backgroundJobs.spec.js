import { test, expect } from '@playwright/test';
import { posInstance } from './helpers/posInstance.js';


const url = './backgroundJobs';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Background Jobs', exact: true}).first().click();

  await expect(page).toHaveTitle('Jobs: qa-poscli-gui-ci.staging.oregon.platform-os.com/');
});


test('viewing scheduled background jobs', async ({ page }) => {
  await page.goto(posInstance.MPKIT_URL + 'background_job');
  await expect(page.getByText('background job scheduled')).toBeVisible();

  await page.goto(url);

  await expect(page.getByRole('cell', { name: 'scheduled background job' }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('cell', { name: 'high' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'in 10 minutes' }).first()).toBeVisible();
});


test('viewing background job details', async ({ page }) => {
  await page.goto(posInstance.MPKIT_URL + 'background_job');
  await expect(page.getByText('background job scheduled')).toBeVisible();

  await page.goto(url);

  await page.getByRole('link', { name: 'scheduled background job' }).first().click();
  await expect(page.getByRole('heading', { name: 'scheduled background job' })).toBeVisible();
  await expect(page.locator('span.label .property').first()).toBeVisible();

  // close details panel
  await page.getByRole('link', { name: 'Close details' }).click();
  await expect(page.getByRole('heading', { name: 'scheduled background job' })).toBeHidden();
});


test('deleting scheduled background job', async ({ page }) => {
  await page.goto(posInstance.MPKIT_URL + 'background_job_to_delete');
  await expect(page.getByText('background job scheduled')).toBeVisible();

  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to delete this background job?');
    await dialog.accept();
  });

  await page.goto(url);
  await expect(page.locator('tr:has-text("background job to delete")').first()).toBeVisible({ timeout: 10000 });

  for(const job of await page.locator('tr:has-text("background job to delete")').all()){
    await job.getByRole('button', { name: 'More options' }).click();
    await job.getByRole('button', { name: 'Delete background job' }).click();
    await expect(job).toBeHidden(20000);
  }
});
