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
