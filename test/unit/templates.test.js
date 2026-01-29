import { fillInTemplateValues } from '#lib/templates';
import fs from 'fs';

const fileWithTemplatePath = 'test/fixtures/template.liquid';
const missformatedTemplatePath = 'test/fixtures/missformatedTemplate.html';

test('ignores file if template values are empty', () => {
  expect(fillInTemplateValues(missformatedTemplatePath, Object({}))).not.toEqual(fs.readFileSync(missformatedTemplatePath, 'utf8'));
});

test('returns oryginal file body if it runs into error', () => {
  expect(fillInTemplateValues(missformatedTemplatePath, Object({ 'aKey': 1}))).toEqual(fs.readFileSync(missformatedTemplatePath, 'utf8'));
});

test('fills template with values ', () => {
  const templateValues = Object({
    'aKey': 'aStringValue',
    'otherKey': 1
  });
  const result = fillInTemplateValues(fileWithTemplatePath, templateValues);
  const normalized = result.replace(/\r\n/g, '\n');
  expect(normalized).toEqual(`---
slug: aStringValue
---

Page number: 1
`);
});

test('render nothing for non existing keys ', () => {
  const templateValues = Object({
    'otherKey': 1
  });
  const result = fillInTemplateValues(fileWithTemplatePath, templateValues);
  const normalized = result.replace(/\r\n/g, '\n');
  expect(normalized).toEqual(`---
slug: 
---

Page number: 1
`);
});
