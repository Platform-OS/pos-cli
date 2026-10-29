import { test, expect } from '@playwright/test';
import { posInstance } from './helpers/posInstance.js';


const url = './constants';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Constants', exact: true}).first().click();

  await expect(page).toHaveTitle(`Constants: ${posInstance.MPKIT_URL.replace('https://', '')}`);
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


test('showing a constant name with markup as text in the notification', async ({ page }) => {
  // notifications used to be rendered as HTML, so a name like this one became a <b> element
  const name = 'TEST_CONSTANT_<b>MARKUP</b>';

  page.on('dialog', dialog => dialog.accept());

  await page.goto(url);

  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Value').fill('TEST_VALUE_MARKUP');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByText(`Constant ${name} created`)).toBeVisible();
  await expect(page.locator('[aria-live] b')).toHaveCount(0);

  await page.locator(`li:has-text("${name}")`).getByRole('button', { name: 'Delete constant' }).click();
  await expect(page.getByText(`Constant ${name} deleted`)).toBeVisible();
});


// purpose:   makes the instance refuse the constant mutations, the way it answers a GraphQL error
// ------------------------------------------------------------------------
const refuseMutations = async (page) => {
  await page.route('**/api/graph', async route => {
    const query = route.request().postData() ?? '';

    if(query.includes('constant_set(') || query.includes('constant_unset(')){
      await route.fulfill({ json: { errors: [{ message: 'refused' }], data: null } });
    } else if(query.includes('constants(')){
      await route.fulfill({ json: { data: { constants: { results: [{ name: 'REFUSED_CONSTANT', value: 'REFUSED_VALUE', updated_at: new Date().toISOString() }] } } } });
    } else {
      await route.fallback();
    }
  });
};


test('telling that a constant could not be created', async ({ page }) => {
  await refuseMutations(page);
  await page.goto(url);

  await page.getByLabel('Name').fill('TEST_CONSTANT_REFUSED');
  await page.getByLabel('Value').fill('TEST_VALUE_REFUSED');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.locator('.notification.error:not(.disabled)')).toContainText('Failed to create TEST_CONSTANT_REFUSED constant');
});


test('telling that a constant could not be updated', async ({ page }) => {
  await refuseMutations(page);
  await page.goto(url);

  await page.getByRole('button', { name: 'Show value' }).click();
  await page.getByLabel('REFUSED_CONSTANT').fill('CHANGED_VALUE');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.locator('.notification.error:not(.disabled)')).toContainText('Failed to update REFUSED_CONSTANT constant');
});


test('telling that a constant could not be deleted', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await refuseMutations(page);
  await page.goto(url);

  await page.getByRole('button', { name: 'Delete constant' }).click();

  await expect(page.locator('.notification.error:not(.disabled)')).toContainText('Failed to delete REFUSED_CONSTANT constant');
  await expect(page.getByLabel('REFUSED_CONSTANT')).toBeVisible();
});
