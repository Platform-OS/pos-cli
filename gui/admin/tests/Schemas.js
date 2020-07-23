import { Selector } from 'testcafe';

fixture('Schemas').page(`http://localhost:3333/Models`);

test('Lists all schemas', async t => {
  await t.expect(Selector('h1').withText('contact_request').exists).ok()
  await t.expect(Selector('h1').withText('feedback').exists).ok()
});

test('Lists all schemas properties', async t => {
  await t.expect(Selector('p').withText('company (string)').exists).ok()
  await t.expect(Selector('p').withText('rate (integer)').exists).ok()
});