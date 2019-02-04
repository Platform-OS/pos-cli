const templates = require('./../../lib/templates');

process.env.TEMPLATE_VALUES_FILE_PATH = 'test/fixtures/template-values.json';

const fileWithTemplatePath = 'test/fixtures/template.liquid';
const missformatedTemplatePath = 'test/fixtures/missformatedTemplate.html';

test('loads TEMPLATE_VALUES_FILE_PATH', () => {
  const data = templates.templateData();

  expect(data['aKey']).toBe('aStringValue');
  expect(data['otherKey']).toBe(1);
});

test('returns nothing if it cannont parse the template', () => {
  expect(templates.fillInTemplateValues(missformatedTemplatePath)).toEqual('');
});

test('fills template with values ', () => {
  expect(templates.fillInTemplateValues(fileWithTemplatePath)).toEqual(`---
slug: aStringValue
---

Page number: 1
`);
});
