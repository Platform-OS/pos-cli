import { Selector } from 'testcafe';
import faker from 'faker';

fixture('Models')
  .page(`http://localhost:3333/Models`)
  .beforeEach(async (t) => {
    await t.click(Selector('h1').withText('feedback'));
  });

// TODO: Test pagination on different model than CRUD
// test('List 20 models on load', async (t) => {
//   await t.expect(Selector('article').count).eql(20);
// });

test('Create new record - happy path', async t => {
  const rowsBefore = await Selector('article').count;

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
  await t.wait(1000); // Wait for the server to return new data

  const rowsAfter = await Selector('article').count;

  await t.expect(rowsAfter).eql(rowsBefore + 1);
});

test.skip('Create new record - empty fields', async t => {
  await t.click(Selector('button').withText('New record'));
  await t.click(Selector('button').withText('Create'));

  const article = Selector('article');
  
});
