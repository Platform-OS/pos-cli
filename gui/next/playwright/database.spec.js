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

  // Wait for table header columns to appear - more specific than just 'table'
  await expect(page.locator('th:has-text("id")')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('th:has-text("qa_table_1_array")')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('th:has-text("created at")')).toBeVisible({ timeout: 10000 });

  // Wait for specific data cells
  await expect(page.getByRole('cell', { name: 'Aliquam condimentum condimentum'})).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible({ timeout: 10000 });

  await page.getByText('qa_table_2', { exact: true }).click();
  // Wait for qa_table_2 specific column to ensure table has loaded
  await expect(page.getByRole('cell', { name: 'qa_table_2_array' })).toBeVisible({ timeout: 10000 });
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


// MISSING: Filtering array by 'not_value_in'. It works, but it also filters out the empty arrays
// even when there is no empty element in the filter


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

  await expect(page.locator('table > tr').nth(0).locator('td').nth(2)).toContainText('true');
  await expect(page.locator('table > tr').nth(1).locator('td').nth(2)).toContainText('false');
  await expect(page.locator('table > tr').nth(2).locator('td').nth(2)).toContainText('null');
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

  await expect(page.locator('table > tr:first-of-type td:first-child')).not.toContainText('1');

  await page.locator('select[name="by"]').selectOption('id');
  await page.locator('select[name="order"]').selectOption('ASC');

  await expect(page.locator('table > tr:first-of-type td:first-child')).toContainText('1');

  await page.locator('select[name="by"]').selectOption('qa_table_1_int');
  await page.locator('select[name="order"]').selectOption('DESC');

  await expect(page.locator('table > tr:first-of-type td:nth-child(5)')).toContainText('2137');
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


test('editing a record', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();

  await page.getByRole('button', { name: 'Create new record' }).click();
  await page.getByLabel('qa_table_1_array').fill('["new_array_item_3", "new_array_item_4"]');

  await page.getByRole('button', { name: 'Create record' }).click();

  await expect(page.getByRole('cell', { name: '["new_array_item_3"' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit record' }).first().click();
  await page.getByLabel('qa_table_1_array').fill('["edited_array_item_3", "edited_array_item_4"]');
  const dialog = page.locator('dialog');
  await dialog.getByRole('button', { name: 'Edit record' }).first().click();

  await expect(page.getByRole('cell', { name: '["new_array_item_3"' })).toBeHidden();
  await expect(page.getByRole('cell', { name: '["edited_array_item_3"' })).toBeVisible();
});


test('deleting a record', async ({ page }) => {
  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to delete this record?');
    await dialog.accept();
  });

  await page.goto(url);
  await page.getByText('qa_table_1').click();

  await page.getByRole('button', { name: 'Create new record' }).click();
  await page.getByLabel('qa_table_1_array').fill('["to_be_deleted_array"]');

  await page.getByRole('button', { name: 'Create record' }).click();

  await expect(page.getByRole('cell', { name: '["to_be_deleted_array"' })).toBeVisible();

  await page.getByRole('button', { name: 'More options' }).first().click();
  await page.getByRole('button', { name: 'Delete record' }).click();

  await expect(page.getByRole('cell', { name: '["to_be_deleted_array"' })).toBeHidden();
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


test('restoring deleted record', async ({ page }) => {
  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to delete this record?');
    await dialog.accept();
  });

  await page.goto(url);
  await page.getByText('qa_table_4').click();

  // Wait for the specific record to appear in the table
  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeVisible({ timeout: 10000 });

  // Switch to deleted records view
  await page.getByTitle('Show deleted records').click();

  // Wait for "deleted at" column header to appear - this indicates the view has changed
  await expect(page.locator('th:has-text("deleted at")')).toBeVisible({ timeout: 10000 });
  // The record should not be visible in deleted view yet (it hasn't been deleted)
  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeHidden({ timeout: 10000 });

  // Switch back to current state
  await page.getByTitle('Show current database state').click();

  // Wait for "deleted at" column to disappear - this indicates we're back to current view
  await expect(page.locator('th:has-text("deleted at")')).toBeHidden({ timeout: 10000 });
  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeVisible({ timeout: 10000 });

  // Delete the record
  await page.getByRole('button', { name: 'More options' }).first().click();
  await page.getByRole('button', { name: 'Delete record' }).click();

  // Wait for the record to disappear from current view (dialog accepted, deletion processed)
  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeHidden({ timeout: 10000 });

  // Switch to deleted records view
  await page.getByTitle('Show deleted records').click();

  // Wait for "deleted at" column and the deleted record to appear
  await expect(page.locator('th:has-text("deleted at")')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeVisible({ timeout: 10000 });

  // Restore the record
  await page.getByRole('button', { name: 'More options' }).first().click();
  await page.getByRole('button', { name: 'Restore record' }).click();

  // Wait for the record to disappear from deleted view (restoration processed)
  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeHidden({ timeout: 10000 });

  // Switch back to current state
  await page.getByTitle('Show current database state').click();

  // Wait for "deleted at" column to disappear and record to reappear
  await expect(page.locator('th:has-text("deleted at")')).toBeHidden({ timeout: 10000 });
  await expect(page.getByRole('cell', { name: 'Record to delete and restore' })).toBeVisible({ timeout: 10000 });
});
