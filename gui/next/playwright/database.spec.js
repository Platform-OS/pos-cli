import { test, expect } from '@playwright/test';
import { posInstance } from './helpers/posInstance.js';


const url = './database';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Database', exact: true}).first().click();

  await expect(page).toHaveTitle(`Database: ${posInstance.MPKIT_URL.replace('https://', '')}`);
});


test('viewing tables list', async ({ page }) => {
  await page.goto(url);

  await expect(page.getByText('qa_table_1')).toBeVisible();
  await expect(page.getByText('qa_table_2')).toBeVisible();
});


test('ability to see table details', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page).toHaveURL(/.*table/);
  await expect(page.getByRole('columnheader', { name: 'id' }).and(page.locator('th'))).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'qa_table_1_array' }).and(page.locator('th'))).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'created at' }).and(page.locator('th'))).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Aliquam condimentum condimentum'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();

  await page.getByText('qa_table_2', { exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'qa_table_2_array' })).toBeVisible();
});


test('filtering the tables', async ({ page }) => {
  await page.goto(url);

  await page.getByPlaceholder('Search tables').fill('qa_table_2');
  await expect(page.getByRole('link', { name: 'qa_table_1' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'qa_table_2' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset filter' }).click();
  await expect(page.getByPlaceholder('Search tables')).toHaveValue('');
  await expect(page.getByRole('link', { name: 'qa_table_1' })).toBeVisible();
});


test('filtering records by id', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.getByPlaceholder('filter value').type('2');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
});


test('filtering record array by array_contains', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_array');
  await page.locator('select[name="operation"]').selectOption('array_contains');
  await page.getByPlaceholder('filter value').fill('qa_table_1_array2_item1');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
});


test('filtering record array by value_in', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_array');
  await page.locator('select[name="operation"]').selectOption('value_in');
  await page.getByPlaceholder('filter value').fill('["qa_table_1_array3_item1", "another_item"]');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
});


// MISSING: Filtering array by 'exists' but can the field of type array not exist? Or will it just be an empty array always?


test('filtering record array by array_overlaps', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_array');
  await page.locator('select[name="operation"]').selectOption('array_overlaps');
  await page.getByPlaceholder('filter value').fill('["qa_table_1_array2_item1"]');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
});


test('filtering record array by not_array_contains', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_array');
  await page.locator('select[name="operation"]').selectOption('not_array_contains');
  await page.getByPlaceholder('filter value').fill('qa_table_1_array3_item1');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
});


test('filtering record array by not_array_overlaps', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_array');
  await page.locator('select[name="operation"]').selectOption('not_array_overlaps');
  await page.getByPlaceholder('filter value').fill('["qa_table_1_array2_item1"]');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeHidden();
});


test('filtering record array by not_value_array', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_array');
  await page.locator('select[name="operation"]').selectOption('not_value_array');
  await page.getByPlaceholder('filter value').fill('["qa_table_1_array3_item1"]');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
});


// MISSING: Filtering array by 'not_value_in'. It works, but it also filters out the empty arrays even when there is no empty element in the filter


test('filtering record int by value_int', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_int');
  await page.locator('select[name="operation"]').selectOption('value_int');
  await page.getByPlaceholder('filter value').fill('3721');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
});


test('filtering record int by exists', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_int');
  await page.locator('select[name="operation"]').selectOption('exists');
  await page.locator('select[name="value"]').selectOption('true');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();

  await page.locator('select[name="value"]').selectOption('false');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeVisible();
});


test('filtering record int by not_value_int', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_int');
  await page.locator('select[name="operation"]').selectOption('not_value_int');
  await page.getByPlaceholder('filter value').fill('2137');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
});


test('filtering record int by range', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('[name="name"]').selectOption('qa_table_1_int');
  await page.locator('[name="operation"]').selectOption('range');
  await page.locator('[name="maxFilterValue"]').fill('2137');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();

  await page.locator('[name="maxFilterValue"]').fill('');
  await page.locator('[name="minFilterValue"]').fill('3000');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeHidden();

  await page.locator('[name="maxFilter"]').selectOption('gte');
  await page.locator('[name="maxFilterValue"]').fill('2137');
  await page.locator('[name="minFilterValue"]').fill('');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();

  await page.locator('select[name="minFilter"]').selectOption('lte');
  await page.locator('[name="minFilterValue"]').fill('3721');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
});


test('filtering record string by value', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_string');
  await page.locator('select[name="operation"]').selectOption('value');
  await page.getByPlaceholder('filter value').fill('Lorem ipsum dolor sit amet');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
});


test('filtering record string by exists', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_string');
  await page.locator('select[name="operation"]').selectOption('exists');
  await page.locator('select[name="value"]').selectOption('true');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '[]'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();

  await page.locator('select[name="value"]').selectOption('false');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '[]'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeVisible();
});


test('filtering record string by contains', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_string');
  await page.locator('select[name="operation"]').selectOption('contains');
  await page.getByPlaceholder('filter value').fill('condimentum condimentum');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
});


test('filtering record string by ends_with', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_string');
  await page.locator('select[name="operation"]').selectOption('ends_with');
  await page.getByPlaceholder('filter value').fill('congue non.');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
});


test('filtering record string by not_contains', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_string');
  await page.locator('select[name="operation"]').selectOption('not_contains');
  await page.getByPlaceholder('filter value').fill('congue non');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '[]'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
});


test('filtering record string by not_ends_with', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_string');
  await page.locator('select[name="operation"]').selectOption('not_ends_with');
  await page.getByPlaceholder('filter value').fill('sit amet');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '[]'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
});


test('filtering record string by not_starts_with', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_string');
  await page.locator('select[name="operation"]').selectOption('not_starts_with');
  await page.getByPlaceholder('filter value').fill('Lorem ipsum');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '[]'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
});


test('filtering record string by not_value', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_string');
  await page.locator('select[name="operation"]').selectOption('not_value');
  await page.getByPlaceholder('filter value').fill('Lorem ipsum dolor sit amet');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '[]'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
});


test('filtering record string by starts_with', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_string');
  await page.locator('select[name="operation"]').selectOption('starts_with');
  await page.getByPlaceholder('filter value').fill('Lorem ipsum');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '[]'})).toBeHidden();
});


test('filtering record datetime by value', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_datetime');
  await page.locator('select[name="operation"]').selectOption('starts_with');
  await page.getByPlaceholder('filter value').fill('2007');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeVisible();
});


test('distinguishing between boolean data and false values', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await expect(page.locator('table > tbody > tr').nth(0).locator('td').nth(2)).toContainText('true');
  await expect(page.locator('table > tbody > tr').nth(1).locator('td').nth(2)).toContainText('false');
  await expect(page.locator('table > tbody > tr').nth(2).locator('td').nth(2)).toContainText('null');
});

test('filtering record boolean by value_boolean', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await page.locator('select[name="name"]').selectOption('qa_table_1_boolean');
  await page.locator('select[name="operation"]').selectOption('value_boolean');
  await page.getByPlaceholder('filter value').fill('true');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();

  await page.getByPlaceholder('filter value').fill('false');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: 'Nam lorem nibh, ultricies at blandit'})).toBeVisible();
});


test('reordering records', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  await expect(page.locator('table > tbody > tr:first-of-type td:first-child')).not.toContainText('1');

  await page.locator('select[name="by"]').selectOption('id');
  await page.locator('select[name="order"]').selectOption('ASC');

  await expect(page.locator('table > tbody > tr:first-of-type td:first-child')).toContainText('1');

  await page.locator('select[name="by"]').selectOption('qa_table_1_int');
  await page.locator('select[name="order"]').selectOption('DESC');

  await expect(page.locator('table > tbody > tr:first-of-type td:nth-child(5)')).toContainText('2137');
});


test('adding a record successfully', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await page.getByRole('button', { name: 'Create new record' }).click();

  await page.getByLabel('qa_table_1_array').fill('["new_array_item_1", "new_array_item_2"]');
  await page.getByLabel('qa_table_1_int').fill('2137');
  await page.getByText('json', { exact: true }).first().click();
  await page.getByLabel('qa_table_1_json').fill('{"new_json_element_1": "new_json_value_1", "new_json_element_2": "new_json_value_2"}');
  await page.getByLabel('qa_table_1_string').fill('This is a new string to be tested');

  await page.getByRole('button', { name: 'Create record' }).click();

  await expect(page.getByRole('cell', { name: '["new_array_item_1"' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '2137' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '{"new_json_element_1"' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'This is a new' })).toBeVisible();
});

test('adding a record with broken JSON and expecting validation error', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await page.getByRole('button', { name: 'Create new record' }).click();

  await page.getByLabel('qa_table_1_array').fill('["new_array_item_3", "new_array_item_4"]');
  await page.getByText('json', { exact: true }).first().click();
  await page.getByLabel('qa_table_1_json').fill('{new_json_element_3: "new_json_value_3", new_json_element_4: "new_json_value_4"}');

  await page.getByRole('button', { name: 'Create record' }).click();

  await expect(page.getByText('Not a valid JSON')).toBeVisible();
});

test('adding a record with broken array and expecting validation error', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();
  await page.getByRole('button', { name: 'Create new record' }).click();

  await page.getByLabel('qa_table_1_array').fill('["new_array_item_3", new_array_item_4]');

  await page.getByRole('button', { name: 'Create record' }).click();

  await expect(page.getByText('Not a valid array')).toBeVisible();
});


test('editing a record', async ({ page }, testInfo) => {
  // Unique per attempt: a retry runs against the record the previous attempt left behind, and
  // a value shared with it would match two cells and fail Playwright's strict mode.
  const item = `new_array_item_3_${testInfo.retry}`;
  const editedItem = `edited_array_item_3_${testInfo.retry}`;

  await page.goto(url);

  await page.getByText('qa_table_1').click();

  await page.getByRole('button', { name: 'Create new record' }).click();
  await page.getByLabel('qa_table_1_array').fill(`["${item}", "new_array_item_4"]`);

  await page.getByRole('button', { name: 'Create record' }).click();

  const createdCell = page.getByRole('cell', { name: `["${item}"` });
  await expect(createdCell).toBeVisible();

  // Edit the row holding this test's own record, not the first row: records are listed newest
  // first and the other workers create records in the same table, so between this create and
  // the list refresh that follows it another test's record can take the top row.
  await page.locator('tr', { has: createdCell }).getByRole('button', { name: 'Edit record' }).click();
  await page.getByLabel('qa_table_1_array').fill(`["${editedItem}", "edited_array_item_4"]`);
  const dialog = page.locator('dialog');
  await dialog.getByRole('button', { name: 'Edit record' }).first().click();

  await expect(createdCell).toBeHidden();
  await expect(page.getByRole('cell', { name: `["${editedItem}"` })).toBeVisible();
});


test('deleting a record', async ({ page }, testInfo) => {
  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to delete this record?');
    await dialog.accept();
  });

  // Unique per attempt, for the same reason as in 'editing a record' above.
  const item = `to_be_deleted_array_${testInfo.retry}`;

  await page.goto(url);
  await page.getByText('qa_table_1').click();

  await page.getByRole('button', { name: 'Create new record' }).click();
  await page.getByLabel('qa_table_1_array').fill(`["${item}"]`);

  await page.getByRole('button', { name: 'Create record' }).click();

  const createdCell = page.getByRole('cell', { name: `["${item}"` });
  await expect(createdCell).toBeVisible();

  // Delete the row holding this test's own record, not the first row: another test's record can
  // take the top row while this one runs.
  const createdRow = page.locator('tr', { has: createdCell });
  await createdRow.getByRole('button', { name: 'More options' }).click();
  await createdRow.getByRole('button', { name: 'Delete record' }).click();

  await expect(createdCell).toBeHidden();
});



test('telling that a record could not be deleted', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());

  // the instance refuses the deletion, answering the way GraphQL does: errors, and no record
  await page.route('**/api/graph', async route => {
    if(route.request().postData()?.includes('record_delete')){
      await route.fulfill({ json: { errors: [{ message: 'refused' }], data: { record_delete: null } } });
    } else {
      await route.fallback();
    }
  });

  await page.goto(url);
  await page.getByText('qa_table_1').click();

  const row = page.locator('tbody tr').first();
  await row.getByRole('button', { name: 'More options' }).click();
  await row.getByRole('button', { name: 'Delete record' }).click();

  await expect(page.getByText(/Record \d+ could not be deleted/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('pagination', async ({ page }) => {
  await page.goto(url);
  await page.getByText('qa_table_3').click();

  await expect(page.getByText('of 2')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Twenty five' })).toBeVisible();

  await page.getByLabel('Page:').fill('2');
  await expect(page.getByRole('cell', { name: 'Twenty five' })).toBeHidden();
  await expect(page.getByRole('cell', { name: 'Five', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Previous page'}).click();
  await expect(page.getByRole('cell', { name: 'Twenty five' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Five', exact: true })).toBeHidden();

  await page.getByRole('button', { name: 'Next page'}).click();
  await expect(page.getByRole('cell', { name: 'Twenty five' })).toBeHidden();
  await expect(page.getByRole('cell', { name: 'Five', exact: true })).toBeVisible();
});


test('expanded view', async ({ page }) => {
  await page.goto(url);
  await page.getByText('qa_table_1').click();

  await page.getByRole('button', { name: 'Expand values'}).click();
  await expect(page.getByRole('cell', { name: 'Aliquam condimentum condimentum ultricies. Aenean mollis posuere purus, non gravida tortor congue non.', exact: true })).toBeVisible();
});


test('restoring deleted record', async ({ page, request }) => {
  const graph = async (query, variables) => {
    const response = await request.post('http://127.0.0.1:3333/api/graph', { data: { query, variables } });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).data;
  };

  // an attempt that stopped half way leaves the record deleted, and a retry has to start from
  // the record in place
  const { records } = await graph('{ records(per_page: 100, filter: { deleted_at: { exists: true } }) { results { id table properties } } }');
  for(const deleted of records.results.filter(item => item.table === 'qa_table_4' && item.properties.qa_table_4_string === 'Record to delete and restore')){
    await graph('mutation($id: ID!, $table: String!) { record_update(id: $id, record: { table: $table, deleted_at: null }) { id } }', { id: deleted.id, table: deleted.table });
  }

  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to delete this record?');
    await dialog.accept();
  });

  await page.goto(url);
  await page.getByText('qa_table_4').click();

  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeVisible();

  await page.getByTitle('Show deleted records').click();

  await expect(page.getByRole('columnheader', { name: 'deleted at' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeHidden();

  await page.getByTitle('Show current database state').click();
  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeVisible();

  await page.getByRole('button', { name: 'More options' }).first().click();
  await page.getByRole('button', { name: 'Delete record' }).click();
  // the list follows the instance's answer, which a slow instance gives after several seconds
  await expect(page.getByText(/Record \d+ deleted/)).toBeVisible({ timeout: 20000 });

  await page.getByTitle('Show deleted records').click();
  await expect(page.getByRole('columnheader', { name: 'deleted at' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeVisible();

  await page.getByRole('button', { name: 'More options' }).first().click();
  await page.getByRole('button', { name: 'Restore record' }).click();
  await expect(page.getByText(/Record \d+ restored/)).toBeVisible({ timeout: 20000 });

  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeHidden();

  await page.getByTitle('Show current database state').click();
  await expect(page.getByRole('columnheader', { name: 'deleted at' })).toBeHidden();
  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeVisible();
});



test('closing the record form with Escape after typing in it', async ({ page }) => {
  await page.goto(url);
  await page.getByText('qa_table_1').click();

  // a document listener added with { once: true } was used up by the first key typed into the
  // form, so Escape only closed the <dialog> natively and the form could not be opened again
  await page.getByRole('button', { name: 'Create new record' }).click();
  await page.getByLabel('qa_table_1_string').pressSequentially('typed');
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).toBeHidden();

  await page.getByRole('button', { name: 'Create new record' }).click();
  await expect(page.locator('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).toBeHidden();
});


test('leaving the database page and coming back does not add keyboard listeners', async ({ page }) => {
  // count the keydown listeners on document: one added and never removed per visit is a leak
  // that nothing on screen shows, because the stale one toggles a layout that no longer exists
  await page.addInitScript(() => {
    const listeners = new Set();
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options){
      if(this === document && type === 'keydown'){ listeners.add(listener); }
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function(type, listener, options){
      if(this === document && type === 'keydown'){ listeners.delete(listener); }
      return remove.call(this, type, listener, options);
    };
    window.keydownListenerCount = () => listeners.size;
  });

  // the listeners are added as the components mount, after the page shows, so the count is read
  // once it has stopped changing
  const settledCount = async () => {
    let previous;
    let current = await page.evaluate(() => window.keydownListenerCount());
    do {
      previous = current;
      await page.waitForTimeout(250);
      current = await page.evaluate(() => window.keydownListenerCount());
    } while(current !== previous);
    return current;
  };

  await page.goto(url);
  await expect(page.getByText('qa_table_1')).toBeVisible();
  const onFirstVisit = await settledCount();
  expect(onFirstVisit).toBeGreaterThan(0);

  for(let visit = 0; visit < 3; visit++){
    await page.getByRole('link', { name: 'Users', exact: true }).first().click();
    await expect(page).toHaveURL(/users/);
    await page.getByRole('link', { name: 'Database', exact: true }).first().click();
    await expect(page.getByText('qa_table_1')).toBeVisible();
  }

  expect(await settledCount()).toBe(onFirstVisit);

  // and the shortcut still works: the tables filter takes focus on load, so leave it first
  const layout = page.locator('div.container:has(.tables-container)');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('b');
  await expect(layout).toHaveClass(/tablesHidden/);
  await page.keyboard.press('b');
  await expect(layout).not.toHaveClass(/tablesHidden/);
});


test('keeping the sorting and page in the url', async ({ page }) => {
  await page.goto(url);
  await page.getByText('qa_table_3').click();
  await expect(page.getByText('of 2')).toBeVisible();

  await page.locator('select[name="by"]').selectOption('id');
  await page.locator('select[name="order"]').selectOption('ASC');
  await expect(page).toHaveURL(/sort_by=id/);
  await expect(page).toHaveURL(/sort_order=ASC/);

  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page).toHaveURL(/page=2/);
  const firstOnSecondPage = await page.locator('table > tbody > tr:first-of-type td:first-child').innerText();

  // the view is the url, so a reload shows the same records
  await page.reload();
  await expect(page.locator('select[name="by"]')).toHaveValue('id');
  await expect(page.locator('select[name="order"]')).toHaveValue('ASC');
  await expect(page.getByLabel('Page:')).toHaveValue('2');
  await expect(page.locator('table > tbody > tr:first-of-type td:first-child')).toHaveText(firstOnSecondPage);
});


test('ignoring a sorting or filter in the url that is not valid', async ({ page }) => {
  await page.goto(url);
  await page.getByText('qa_table_1').click();
  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();

  // these end up in the text of a GraphQL query, so a link must not be able to write into it
  const tableUrl = new URL(page.url());
  tableUrl.search = new URLSearchParams({
    sort_by: 'id: { order: ASC } }) { total_entries } x: records(per_page: 1',
    sort_order: 'SIDEWAYS',
    filter_name: 'id',
    filter_type: 'id',
    filter_operation: 'value',
    filter_value: '1 } }) { total_entries'
  }).toString();
  await page.goto(tableUrl.toString());

  await expect(page.getByText('Lorem ipsum dolor sit amet')).toBeVisible();
  await expect(page.locator('select[name="by"]')).toHaveValue('created_at');
  await expect(page.locator('select[name="order"]')).toHaveValue('DESC');
});
