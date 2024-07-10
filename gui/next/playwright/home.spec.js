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
