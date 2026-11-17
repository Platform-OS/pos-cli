import { test, expect } from '@playwright/test';


// A token limited to scopes is reported by /info, and the GUI hides what the instance would
// refuse it. These tests answer every request to the gui server themselves -- /info with the
// scopes under test, /api/graph with what the instance would say -- so they need no limited
// token on a real instance, and none of them imports posInstance.


// purpose:   answers /info as `pos-cli gui serve` does for a token with these scopes
// arguments: page (object), the token's scopes, or null for a token with full access (array|null),
//            what to answer /api/graph with (function receiving the query text, returning
//            { status, json }), and the graph queries seen, collected as they arrive (array)
// ------------------------------------------------------------------------
const serveAs = async (page, scopes, { graph = () => ({ json: { data: {} } }), seen = [] } = {}) => {
  await page.route(/^http:\/\/(localhost|127\.0\.0\.1):3333\//, async route => {
    const url = new URL(route.request().url());

    if(url.pathname === '/info'){
      await route.fulfill({ json: { MPKIT_URL: 'https://limited.example.com', version: 'test', scopes } });
    } else if(url.pathname === '/api/graph'){
      const query = route.request().postData() ?? '';
      seen.push(query);
      const { status = 200, json } = graph(query);
      await route.fulfill({ status, json });
    } else {
      await route.fulfill({ json: {} });
    }
  });
};

const tile = (page, name) => page.locator('.applications > .application', { has: page.getByRole('heading', { name, exact: true }) });

const GUARDED_TILES = ['Database', 'Users', 'Background Jobs', 'Constants', 'Liquid Evaluator'];


test('a token with full access sees every tool on the home page', async ({ page }) => {
  await serveAs(page, null);
  await page.goto('./');

  await expect(page.locator('.instance')).toContainText('limited.example.com');
  for(const name of [...GUARDED_TILES, 'Logs']){
    await expect(tile(page, name), name).toBeVisible();
  }
});


// The header hid these links already; the tiles led to the same pages, and hovering Database
// asked the instance for admin_tables, which the token cannot read.
test('a limited token sees only the tools its scopes allow on the home page', async ({ page }) => {
  const seen = [];
  await serveAs(page, ['logs:read'], { seen });
  await page.goto('./');

  // /info has been applied once the badge is up; before that every tile is shown
  await expect(page.getByText('Limited token')).toBeVisible();

  await expect(tile(page, 'Logs')).toBeVisible();
  for(const name of GUARDED_TILES){
    await expect(tile(page, name), name).toHaveCount(0);
  }

  await page.getByRole('link', { name: 'Logs', exact: true }).first().hover();
  expect(seen.filter(query => query.includes('admin_tables'))).toEqual([]);
});


// The instance refuses with { error, required_scopes } and no `errors`, so graphql() resolved
// undefined and the page read `.errors` off it: no notification of the failure, and a TypeError.
test('a change the token\'s scopes refuse is reported as a failure', async ({ page }) => {
  await serveAs(page, null, {
    graph: query => {
      if(query.includes('constant_set(')){
        return { status: 403, json: { error: 'insufficient_scope', required_scopes: ['constants:write'] } };
      }
      if(query.includes('constants(')){
        return { json: { data: { constants: { results: [{ name: 'SCOPED_CONSTANT', value: 'VALUE', updated_at: new Date().toISOString() }] } } } };
      }
      return { json: { data: {} } };
    }
  });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error));
  await page.goto('./constants');

  await page.getByRole('button', { name: 'Show value' }).click();
  await page.getByLabel('SCOPED_CONSTANT').fill('CHANGED_VALUE');
  await page.getByRole('button', { name: 'Save' }).click();

  const errors = page.locator('.notification.error:not(.disabled)');
  await expect(errors.filter({ hasText: 'It needs constants:write.' })).toBeVisible();
  await expect(errors.filter({ hasText: 'Failed to update SCOPED_CONSTANT constant' })).toBeVisible();
  await expect(page.getByText('Constant SCOPED_CONSTANT updated')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
