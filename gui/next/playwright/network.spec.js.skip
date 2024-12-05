import { test, expect } from '@playwright/test';
import { posInstance } from './helpers/posInstance.js';


const url = './network';


test('see link on home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Network Logs', exact: true}).first().click();

  await expect(page).toHaveTitle('Logs: ' + posInstance.MPKIT_URL.replace('https://', ''));
});

test('viewing logs', async ({ page }) => {
  const currentTime = Date.now();

  await page.goto(posInstance.MPKIT_URL + `log?${currentTime}`);
  await expect(page.getByText('Registering a log: info')).toBeVisible();
  await page.goto(posInstance.MPKIT_URL + `/thisWillReturn404.jpg`);
  await expect(page.getByText('Not Found')).toBeVisible();

  await page.waitForTimeout(4000);

  await page.goto(url);

  await expect(page.getByText(`/log`).first()).toBeVisible();
  await expect(page.getByText(`/thisWillReturn404.jpg`)).toBeVisible();
});


test('filtering logs', async ({ page }) => {
  await page.goto(url);

  await expect(page.getByRole('cell', { name: '200'}).first()).toBeVisible();

  await page.goto(posInstance.MPKIT_URL + `/thisWillReturn404.jpg`);
  await expect(page.getByText('Not Found')).toBeVisible();

  await page.waitForTimeout(4000);

  await page.goto(url);

  // filtering by status code
  await page.getByLabel('404').check();
  await expect(page.getByRole('cell', { name: '200'})).toBeHidden();
  await expect(page.getByRole('cell', { name: '404'}).first()).toBeVisible();

  // reset filters
  await page.getByRole('link', { name: 'Reset'}).click();
  await expect(page.getByLabel('404')).not.toBeChecked();
});



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