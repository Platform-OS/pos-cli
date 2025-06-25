import { test, expect } from '@playwright/test';
import { posInstance } from './helpers/posInstance.js';


const url = './users';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Users', exact: true}).first().click();

  await expect(page).toHaveTitle(`Users: ${posInstance.MPKIT_URL.replace('https://', '')}`);
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

test('adding a new user successfully', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new user' }).click();

  await page.getByLabel('Email').fill('testnew@test.test');
  await page.getByLabel('Password').fill('testpassword');

  await page.getByRole('button', { name: 'Create user' }).click();

  await expect(page.getByRole('cell', { name: 'testnew@test.test'})).toBeVisible();
});


test('editing an existing user', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('button', { name: 'Edit user' }).first().click();
  await page.getByLabel('Email').fill('testedit2@test.test');
  const dialog = page.locator('dialog');
  await dialog.getByRole('button', { name: 'Edit user' }).first().click();

  await expect(page.getByRole('cell', { name: 'testedit@test.test' })).toBeHidden(20000);
  await expect(page.getByRole('cell', { name: 'testedit2@test.test' })).toBeVisible();
});


test('deleting an existing user', async ({ page }) => {
  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to delete this user?');
    await dialog.accept();
  });

  await page.goto(url);
  await expect(page.getByRole('cell', { name: 'testdelete@test.test' })).toBeVisible();

  await page.getByRole('button', { name: 'More options' }).first().click();
  await page.getByRole('button', { name: 'Delete user' }).click();

  await expect(page.getByRole('cell', { name: 'testdelete@test.test' })).toBeHidden();
});
