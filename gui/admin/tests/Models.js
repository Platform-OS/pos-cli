import { Selector } from 'testcafe';
import faker from 'faker';

fixture('Models')
  .page('http://localhost:3333/Models')
  .beforeEach(async (t) => {
    await t.click(Selector('h1').withText('feedback'));
  });

// TODO: Test pagination on different model than CRUD
// test('List 20 models on load', async (t) => {
//   await t.expect(Selector('article').count).eql(20);
// });

test('Create new record - happy path', async t => {
  await t.click(Selector('button').withText('New record'));

  const email = Selector('label').withText('email');
  const message = Selector('label').withText('message');
  const path = Selector('label').withText('path');
  const rate = Selector('label').withText('rate');

  const newEmail = faker.internet.email();
  await t.typeText(email, `"${newEmail}"`);
  await t.typeText(message, `"${faker.lorem.sentence()}"`);
  await t.typeText(path, `"${faker.lorem.slug()}"`);
  await t.typeText(rate, `${faker.random.number()}`);

  await t.click(Selector('button').withText('Create'));

  await t.expect(Selector('*').withText('Model created').exists).ok(); // Notification
});

// test.skip('Create new record - empty fields', async t => {
//   await t.click(Selector('button').withText('New record'));
//   await t.click(Selector('button').withText('Create'));

//   const article = Selector('article');
// });

test('Toggle deleted / non-deleted visibility', async t => {
  const beforeHeading = Selector('article header h3');
  const beforeId = beforeHeading.textContent;

  await t.expect(Selector('button').withText('Delete').exists).ok();

  await t.click(Selector('button').withText('Show deleted')).wait(500);

  await t.expect(Selector('button').withText('Restore record').exists).ok();

  const afterHeading = Selector('article header h3');
  const afterId = afterHeading.textContent;

  await t.expect(afterId).notEql(beforeId);
});

test('Delete record', async t => {
  const heading = Selector('article header h3');
  const id = await heading.textContent;

  await t.setNativeDialogHandler(() => true);
  await t.click(Selector('button').withText('Delete'));

  await t.click(Selector('button').withText('Show deleted')).wait(500);

  const afterHeading = await Selector('article header h3').withText(id);

  await t.expect(afterHeading.exists).ok();
});

test('Restore record', async t => {
  await t.click(Selector('button').withText('Show deleted')).wait(500);

  const heading = Selector('article header h3');
  const id = await heading.textContent;

  await t.click(Selector('button').withText('Restore record'));

  await t.click(Selector('button').withText('Show non-deleted')).wait(500);

  const afterHeading = await Selector('article header h3').withText(id);

  await t.expect(afterHeading.exists).ok();
});

test.only('Pagination', async t => {
  const heading = Selector('article header h3');
  const id = await heading.textContent;

  await t.click(Selector('button').withText('Next page')).wait(500);

  const afterHeading = await Selector('article header h3').withText(id);

  await t.expect(afterHeading.exists).notOk();
});
