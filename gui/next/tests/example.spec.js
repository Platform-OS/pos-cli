import { test, expect } from '@playwright/test';


const url = 'http://localhost:4173';




test('see home screen', async ({ page }) => {
  await page.goto(url);

  await expect(page).toHaveTitle('platformOS Instance Admin');
  await expect(page.locator('body')).toContainText('Partner Portal');
});


test('pin and unpin tools to header navigation', async ({ page }) => {
  await page.goto(url);

  // pin
  await page.getByRole('button', { name: 'Pin GraphiQL to header menu'}).click();
  await expect(page.locator('header').getByRole('link', { name: 'GraphiQL'})).toBeVisible();

  // unpin
  await page.getByRole('button', { name: 'Unpin GraphiQL from header menu'}).click();
  await expect(page.locator('header').getByRole('link', { name: 'GraphiQL'})).toBeHidden();
});


test('showing tools info', async ({ page }) => {
  await page.goto(url);

  // show additional info
  await page.getByRole('button', { name: 'Show more information about Database tool'}).click();
  await expect(page.getByText('Inspect tables and records')).toBeVisible();

  // hide additional info
  await page.getByRole('button', { name: 'Show more information about Database tool'}).click();
  await expect(page.locator('.application').getByText('Inspect tables and records')).not.toHaveClass('showDescription');
});
