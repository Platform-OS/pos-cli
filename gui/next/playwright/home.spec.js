import { test, expect } from '@playwright/test';
import { posInstance } from './helpers/posInstance.js';



test('see home screen', async ({ page }) => {
  await page.goto('./');

  await expect(page).toHaveTitle(`platformOS: ${posInstance.MPKIT_URL.replace('https://', '')}`);
  await expect(page.locator('body')).toContainText('Partner Portal');
});


test('seeing instance URL', async ({ page }) => {
  await page.goto('./');

  await expect(page.locator('.instance')).toContainText(posInstance.MPKIT_URL.replace('https://', ''));
});


test('pin and unpin tools to header navigation', async ({ page }) => {
  await page.goto('./');

  // pin
  await page.getByRole('button', { name: 'Pin GraphiQL to header menu'}).click();
  await expect(page.locator('header').getByRole('link', { name: 'GraphiQL'})).toBeVisible();

  // unpin
  await page.getByRole('button', { name: 'Unpin GraphiQL from header menu'}).click();
  await expect(page.locator('header').getByRole('link', { name: 'GraphiQL'})).toBeHidden();
});


test('showing tools info', async ({ page }) => {
  await page.goto('./');

  // show additional info
  await page.getByRole('button', { name: 'Show more information about Database tool'}).click();
  await expect(page.getByText('Inspect tables and records')).toBeVisible();

  // hide additional info
  await page.getByRole('button', { name: 'Show more information about Database tool'}).click();
  await expect(page.locator('.application').getByText('Inspect tables and records')).not.toHaveClass('showDescription');
});


test('showing documentation and partner portal links', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible();
  await expect(page.getByRole('link' , { name: 'Partner Portal' })).toBeVisible();
});



// purpose:   makes npm report a version other than the running one, so the update button shows
// arguments: page (object), how long npm takes to answer in ms (number)
// ------------------------------------------------------------------------
const routeNewerVersion = async (page, delay = 0) => {
  await page.route('https://registry.npmjs.org/@platformos/pos-cli/latest', async route => {
    await new Promise(resolve => setTimeout(resolve, delay));
    await route.fulfill({ json: { version: '999.0.0' } });
  });
};


test('showing the update button when npm answers before the instance', async ({ page }) => {
  await routeNewerVersion(page);
  // the instance's /info answers only after npm has
  await page.route('**/info', async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.fallback();
  });

  await page.goto('./');

  await expect(page.getByRole('button', { name: 'Update available' })).toBeVisible();
});


test('telling that the update command could not be copied', async ({ page }) => {
  // npm answers after the instance, so this test does not depend on the one above
  await routeNewerVersion(page, 1500);
  // the clipboard refuses, as it does without permission or focus
  await page.addInitScript(() => {
    navigator.clipboard.writeText = () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
  });

  await page.goto('./');
  await page.getByRole('button', { name: 'Update available' }).click();

  await expect(page.locator('.notification.error:not(.disabled)')).toContainText('Could not copy the update command');
});
