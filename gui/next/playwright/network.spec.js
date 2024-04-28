import { test, expect } from '@playwright/test';


const url = './network';


// presets
test('presets keyboard navigation', async ({ page }) => {
  await page.goto(url);

  await page.getByRole('button', { name: 'Choose filters preset'}).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');

  await expect(page.getByRole('link', { name: 'Aggregated slowest requests'})).toBeFocused();

  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');

  await expect(page.getByPlaceholder('Save current view')).toBeFocused();

  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure that you want to delete \'Slowest requests\' preset?');
    await dialog.dismiss();
  });

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Delete');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: 'Aggregated slowest requests' })).not.toBeAttached();
});


test('seeing filters presets popup', async ({ page }) => {
  await page.goto(url);

  await page.getByRole('button', { name: 'Choose filters preset'}).click();

  await expect(page.getByRole('link', { name: 'Aggregated slowest requests' })).toBeVisible();
});


test('using filters presets', async ({ page }) => {
  await page.goto(url);

  await page.getByRole('button', { name: 'Choose filters preset'}).click();
  await page.getByRole('link', { name: 'Aggregated slowest requests' }).click();

  await expect(page).toHaveURL(/aggregate=http_request_path&order_by=median_target_processing_time&order=DESC/);
});


test('removing default preset', async ({ page }) => {
  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure that you want to delete \'Slowest requests\' preset?');
    await dialog.accept();
  });

  await page.goto(url);

  await page.getByRole('button', { name: 'Choose filters preset'}).click();

  await page.getByRole('button', { name: 'Delete \'Slowest requests\' preset' }).click();
  await expect(page.getByRole('link', { name: 'Slowest requests', exact: true })).not.toBeAttached();
});


test('adding a new preset', async ({ page }) => {
  await page.goto(url + '?aggregate=http_request_path&order_by=http_request_path&order=DESC&start_time=2024-04-16&lb_status_codes=123');

  await page.getByRole('button', { name: 'Choose filters preset'}).click();
  await page.getByPlaceholder('Save current view').fill('Test preset');
  await page.getByRole('button', { name: 'Save currently selected filters as new preset' }).click();

  await page.getByRole('link', { name: 'Test preset' }).click();
  await expect(page).toHaveURL(/aggregate=http_request_path&order_by=http_request_path&order=DESC&lb_status_codes=123/);
});