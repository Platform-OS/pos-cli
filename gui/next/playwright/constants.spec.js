import { test, expect } from '@playwright/test';


const url = './constants';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Constants', exact: true}).first().click();

  await expect(page).toHaveTitle('Constants | platformOS');
});


test('adding a constant', async ({ page }) => {
  await page.goto(url);

  await page.getByLabel('Name').fill('TEST_CONSTANT_1');
  await page.getByLabel('Value').fill('TEST_VALUE_1');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByText('Constant TEST_CONSTANT_1 created')).toBeVisible();
  await page.getByRole('button', { name: 'Show value' }).first().click();
  await expect(page.getByLabel('TEST_CONSTANT_1')).toBeVisible();
});


test('deleting a constant', async ({ page }) => {
  await page.goto(url);

  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to delete this constant?');
    await dialog.accept();
  });

  await page.getByLabel('Name').fill('TEST_CONSTANT_2');
  await page.getByLabel('Value').fill('TEST_VALUE_2');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByText('Constant TEST_CONSTANT_2 created')).toBeVisible();
  await page.locator('li:has-text("TEST_CONSTANT_2")').getByRole('button', { name: 'Delete constant' }).click();

  await expect(page.getByText('Constant TEST_CONSTANT_2 deleted')).toBeVisible();
  await expect(page.getByLabel('TEST_CONSTANT_2')).toBeHidden();
});


test('filtering constants', async ({ page }) => {
  await page.goto(url);

  await page.getByLabel('Name').fill('TEST_CONSTANT_3');
  await page.getByLabel('Value').fill('TEST_VALUE_3');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Constant TEST_CONSTANT_3 created')).toBeVisible();

  await page.getByLabel('Name').fill('TEST_CONSTANT_4');
  await page.getByLabel('Value').fill('TEST_VALUE_4');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Constant TEST_CONSTANT_4 created')).toBeVisible();

  await page.getByLabel('Name').fill('TEST_CONSTANT_5');
  await page.getByLabel('Value').fill('TEST_VALUE_5');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Constant TEST_CONSTANT_5 created')).toBeVisible();

  await page.getByLabel('Find:').fill('TEST_CONSTANT_3');

  await expect(page.getByLabel('TEST_CONSTANT_3')).toBeVisible();
  await expect(page.getByLabel('TEST_CONSTANT_4')).toBeHidden();
  await expect(page.getByLabel('TEST_CONSTANT_5')).toBeHidden();
  await expect(page.getByLabel('TEST_CONSTANT_1')).toBeHidden();

  await page.getByRole('button', { name: 'Clear filter' }).click();

  await expect(page.getByLabel('TEST_CONSTANT_3')).toBeVisible();
  await expect(page.getByLabel('TEST_CONSTANT_4')).toBeVisible();
  await expect(page.getByLabel('TEST_CONSTANT_5')).toBeVisible();
});
