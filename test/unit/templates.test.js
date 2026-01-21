import { fillInTemplateValues } from '#lib/templates';
import fs from 'fs';

const fileWithTemplatePath = 'test/fixtures/template.liquid';
const missformatedTemplatePath = 'test/fixtures/missformatedTemplate.html';

// Helper to normalize line endings for cross-platform comparison
const normalizeLineEndings = (str) => str.replace(/\r\n/g, '\n');

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
  expect(normalizeLineEndings(fillInTemplateValues(fileWithTemplatePath, templateValues))).toEqual(`---
slug: aStringValue
---

Page number: 1
`);
});

test('render nothing for non existing keys ', () => {
  const templateValues = Object({
    'otherKey': 1
  });
  // Template has "slug: <%= &aKey =%>" so when aKey is not provided, we get "slug: " with trailing space
  const expected = '---\nslug: \n---\n\nPage number: 1\n';
  expect(normalizeLineEndings(fillInTemplateValues(fileWithTemplatePath, templateValues))).toEqual(expected);
});
