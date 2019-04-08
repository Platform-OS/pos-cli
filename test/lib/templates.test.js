const templates = require('./../../lib/templates');
const fs = require('fs');

const fileWithTemplatePath = 'test/fixtures/template.liquid';
const missformatedTemplatePath = 'test/fixtures/missformatedTemplate.html';

test('returns oryginal file body if it runs into error', () => {
  expect(templates.fillInTemplateValues(missformatedTemplatePath, Object({ "aKey": 1}))).toEqual(fs.readFileSync(missformatedTemplatePath, 'utf8'));
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
