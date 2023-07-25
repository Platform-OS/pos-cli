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
