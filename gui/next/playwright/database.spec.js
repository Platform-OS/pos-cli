import { test, expect } from '@playwright/test';


const url = './database';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Database', exact: true}).first().click();

  await expect(page).toHaveTitle('Database | platformOS');
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
  await expect(page.getByRole('cell', { name: 'id' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'qa_table_1_array' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'created at' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Aliquam condimentum condimentum'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();

  await page.getByText('qa_table_2', { exact: true }).click();
  await expect(page.getByRole('cell', { name: 'qa_table_2_array' })).toBeVisible();
});


test('filtering the tables', async ({ page }) => {
  await page.goto(url);

  await page.getByPlaceholder('Search tables').type('qa_table_2');
  await expect(page.getByRole('link', { name: 'qa_table_1' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'qa_table_2' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset filter' }).click();
  await expect(page.getByPlaceholder('Search tables')).toHaveValue('');
  await expect(page.getByRole('link', { name: 'qa_table_1' })).toBeVisible();
});


test('filtering records by id', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();

  await page.getByPlaceholder('filter value').type('2');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeHidden();
});


test('filtering record array by array_contains', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();

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

  await page.locator('select[name="name"]').selectOption('qa_table_1_string');
  await page.locator('select[name="operation"]').selectOption('starts_with');
  await page.getByPlaceholder('filter value').fill('Lorem ipsum');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByRole('cell', { name: '["qa_table_1_array1_item1"'})).toBeVisible();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array2_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '["qa_table_1_array3_item1"'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '[]'})).toBeHidden();
});


test('reordering records', async ({ page }) => {
  await page.goto(url);

  await page.getByText('qa_table_1').click();

  await expect(page.locator('table > tr:first-of-type td:first-child')).toContainText('5');

  await page.locator('select[name="by"]').selectOption('id');
  await page.locator('select[name="order"]').selectOption('ASC');

  await expect(page.locator('table > tr:first-of-type td:first-child')).toContainText('1');

  await page.locator('select[name="by"]').selectOption('qa_table_1_int');
  await page.locator('select[name="order"]').selectOption('DESC');

  await expect(page.locator('table > tr:first-of-type td:first-child')).toContainText('2');
});


// refreshing, adding, editing, deleting, pagination, expanded view
