import { test, expect } from '@playwright/test';
import { posInstance } from './helpers/posInstance.js';
import { refuseQuery } from './helpers/refuseQuery.js';


const url = './users';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Users', exact: true}).first().click();

  await expect(page).toHaveTitle(`Users: ${posInstance.MPKIT_URL.replace('https://', '')}`);
});


test('viewing users list', async ({ page }) => {
  await page.goto(url);

  await expect(page.getByRole('cell', { name: 'user1@example.com' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'user2@example.com' })).toBeVisible();
});


test('viewing user details', async ({ page }) => {
  await page.goto(url);

  await page.getByRole('link', { name: 'user1@example.com' }).click();

  await expect(page.getByRole('heading', { name: 'user1@example.com' })).toBeVisible();

  await page.getByRole('link', { name: 'Close details' }).click();
  await expect(page.getByRole('heading', { name: 'user1@example.com' })).toBeHidden();
});


test('filtering users by email', async ({ page }) => {
  await page.goto(url);

  await page.locator('[name="value"]').fill('user2@example.com');
  await page.getByRole('button', { name: 'Apply filter' }).click();

  await expect(page.getByRole('cell', { name: 'user2@example.com' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'user1@example.com' })).toBeHidden();
});


test('filtering users by id', async ({ page }) => {
  await page.goto(url);

  await page.locator('[name="attribute"]').selectOption('id');
  await page.locator('[name="value"]').fill('2');
  await page.getByRole('button', { name: 'Apply filter' }).click();

  await expect(page.getByRole('cell', { name: 'user2@example.com' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'user1@example.com' })).toBeHidden();
});

test('adding a new user successfully', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new user' }).click();

  await page.getByLabel('Email').fill('testnew@test.test');
  await page.getByLabel('Password').fill('testpassword');

  await page.getByRole('button', { name: 'Create user' }).click();

  await expect(page.getByRole('cell', { name: 'testnew@test.test'})).toBeVisible();
});



test('adding a user with a broken array and expecting a validation error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  // the form shows the instance's custom user properties; give it an array one, whatever the
  // instance has, and answer the final create without sending a property it may not know
  await page.route('**/api/graph', async route => {
    const query = route.request().postData() ?? '';
    if(query.includes('admin_user_schema')){
      await route.fulfill({ json: { data: { admin_user_schema: { properties: [{ name: 'testArray', attribute_type: 'array' }] } } } });
    } else if(query.includes('user_create')){
      await route.fulfill({ json: { data: { user: { id: '999999' } } } });
    } else {
      await route.fallback();
    }
  });

  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new user' }).click();

  await page.getByLabel('Email').fill('testbroken@test.test');
  await page.getByLabel('Password').fill('testpassword');
  await page.getByLabel('testArray').fill('["not closed"');

  await page.getByRole('button', { name: 'Create user' }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Not a valid array' })).toBeVisible();
  await expect(page.locator('dialog')).toBeVisible();

  // once corrected, the same form creates the user
  await page.getByLabel('testArray').fill('["closed"]');
  await page.getByRole('button', { name: 'Create user' }).click();
  await expect(page.getByText('User 999999 created')).toBeVisible();

  expect(errors).toEqual([]);
});


test('editing an existing user', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('button', { name: 'Edit user' }).nth(1).click();
  await page.getByLabel('Email').fill('testedit2@test.test');
  const dialog = page.locator('dialog');
  await dialog.getByRole('button', { name: 'Edit user' }).first().click();

  await expect(page.getByRole('cell', { name: 'testedit@test.test' })).toBeHidden(20000);
  await expect(page.getByRole('cell', { name: 'testedit2@test.test' })).toBeVisible();
});


test('deleting an existing user', async ({ page }) => {
  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to delete this user?');
    await dialog.accept();
  });

  await page.goto(url);

  const user = page.getByRole('cell', { name: 'testdelete@test.test' });
  await expect(user).toBeVisible();
  const userRow = user.locator('..');
  await userRow.getByRole('button', { name: 'More options' }).first().click();
  await userRow.getByRole('button', { name: 'Delete user' }).click();

  await expect(page.getByRole('cell', { name: 'testdelete@test.test' })).toBeHidden();
});


test('closing the user form with Escape after typing in it', async ({ page }) => {
  await page.goto(url);

  // a document listener added with { once: true } was used up by the first key typed into the form
  await page.getByRole('button', { name: 'Create a new user' }).click();
  await page.getByLabel('Email').pressSequentially('typed');
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).toBeHidden();

  await page.getByRole('button', { name: 'Create a new user' }).click();
  await expect(page.locator('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).toBeHidden();
});


test('keeping the filter after a reload', async ({ page }) => {
  await page.goto(url);

  await page.locator('[name="value"]').fill('user2');
  await page.getByRole('button', { name: 'Apply filter' }).click();
  await expect(page.getByRole('cell', { name: 'user1@example.com' })).toBeHidden();

  // the filter is the url, so a reload shows the same users
  await page.reload();
  await expect(page.locator('[name="value"]')).toHaveValue('user2');
  await expect(page.getByRole('cell', { name: 'user2@example.com' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'user1@example.com' })).toBeHidden();
});


test('treating a filter value from the url as text, not as part of the query', async ({ page }) => {
  // written into the query as it was, this value would end the filter early and make the
  // list match user1; as a string it matches no one
  const value = 'user1" } }) { current_page total_pages results { id email properties } } other: users(per_page: 1, filter: { email: { contains: "user2';

  await page.goto(`${url}?attribute=email&value=${encodeURIComponent(value)}`);

  await expect(page.locator('[name="value"]')).toHaveValue(value);
  await expect(page.getByText('of 1')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'user1@example.com' })).toBeHidden();
  await expect(page.getByRole('cell', { name: 'user2@example.com' })).toBeHidden();
});


// purpose:   runs a GraphQL query against the instance through the GUI server
// arguments: Playwright's request fixture, the query (string), its variables (object)
// returns:   the query's data (object)
// ------------------------------------------------------------------------
const graph = async (request, query, variables) => {
  const response = await request.post('http://127.0.0.1:3333/api/graph', { data: { query, variables } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data;
};

test('adding a user with quotes and backslashes in the password', async ({ page, request }) => {
  // written into the query as it was, the quote would end the string early and
  // the backslash-n would be stored as a new line
  // (an email of its own, so a run that stopped half way cannot block the next)
  const email = `quoted.password.${Date.now()}@test.test`;
  const password = 'say "hi"\\n and \\ go';

  const findUser = async () => {
    const { users } = await graph(request, 'query($email: String, $password: String!) { users(per_page: 1, filter: { email: { value: $email } }) { results { id authenticate { password(password: $password) } } } }', { email, password });
    return users.results[0];
  };

  try {
    await page.goto(url);
    await page.getByRole('button', { name: 'Create a new user' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create user' }).click();

    await expect(page.getByText(/User \d+ created/)).toBeVisible();

    // the password is stored as it was typed
    expect((await findUser())?.authenticate.password).toBe(true);
  } finally {
    const created = await findUser();
    if(created){
      await graph(request, 'mutation($id: ID!) { user_delete(id: $id) { id } }', { id: created.id });
    }
  }
});


test('telling that the users could not be loaded', async ({ page }) => {
  await refuseQuery(page, 'users(');
  await page.goto(url);

  await expect(page.locator('.notification.error:not(.disabled)')).toContainText('Could not load the users: refused by the test');
});


test('telling that both the users and the user could not be loaded', async ({ page }) => {
  // the list and the user details load at the same time, so both errors arrive together
  await refuseQuery(page, 'users(');
  await page.goto(url + '/1');

  await expect(page.locator('.notification.error:not(.disabled)').filter({ hasText: 'Could not load the users: refused by the test' })).toBeVisible();
  await expect(page.locator('.notification.error:not(.disabled)').filter({ hasText: 'Could not load the user: refused by the test' })).toBeVisible();
});
