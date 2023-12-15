import { test, expect } from '@playwright/test';


const url = './users';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Users', exact: true}).first().click();

  await expect(page).toHaveTitle('Users: qa-poscli-gui.staging.oregon.platform-os.com');
});


test('viewing users list', async ({ page }) => {
  await page.goto(url);

  await expect(page.getByRole('cell', { name: 'user1@example.com' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'user2@example.com' })).toBeVisible();
});


test('viewing user details', async ({ page }) => {
  await page.goto(url);

  await page.getByRole('link', { name: 'user1@example.com' }).click();

  await expect(page.getByRole('heading', { name: 'user1@example.com' })).toBeVisible();

  await page.getByRole('link', { name: 'Close details' }).click();
  await expect(page.getByRole('heading', { name: 'user1@example.com' })).toBeHidden();
});


test('filtering users by email', async ({ page }) => {
  await page.goto(url);

  await page.locator('[name="value"]').fill('user2@example.com');
  await page.getByRole('button', { name: 'Apply filter' }).click();

  await expect(page.getByRole('cell', { name: 'user2@example.com' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'user1@example.com' })).toBeHidden();
});


test('filtering users by id', async ({ page }) => {
  await page.goto(url);

  await page.locator('[name="attribute"]').selectOption('id');
  await page.locator('[name="value"]').fill('2');
  await page.getByRole('button', { name: 'Apply filter' }).click();

  await expect(page.getByRole('cell', { name: 'user2@example.com' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'user1@example.com' })).toBeHidden();
});
