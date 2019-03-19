const templates = require('./../../lib/templates');

process.env.TEMPLATE_VALUES_FILE_PATH = 'test/fixtures/template-values.json';

const fileWithTemplatePath = 'test/fixtures/template.liquid';
const missformatedTemplatePath = 'test/fixtures/missformatedTemplate.html';

test('returns nothing if it cannont parse the template', () => {
  expect(templates.fillInTemplateValues(missformatedTemplatePath)).toEqual('');
});

test('fills template with values ', () => {
  const templateValues = Object({
    "aKey": "aStringValue",
    "otherKey": 1
  })
  expect(templates.fillInTemplateValues(fileWithTemplatePath, templateValues)).toEqual(`---
slug: aStringValue
---

Page number: 1
`);
});

test('render nothing for non existing keys ', () => {
  const templateValues = Object({
    "otherKey": 1
  })
  expect(templates.fillInTemplateValues(fileWithTemplatePath, templateValues)).toEqual(`---
slug: 
---

Page number: 1
`);
});
