import fs from 'fs';
import glob from 'fast-glob';

const tags = [
  'cache_for',
  'content_holder_tag_for_path',
  'content_holder',
  'dropdown_menu_block',
  'error',
  'execute_query',
  'featured_items',
  'fields_for',
  'form_tag',
  'hint',
  'input_field_error',
  'input_field',
  'input',
  'label',
  'languages_select',
  'link_to_add_association',
  'link_to_association',
  'link_to_remove_association',
  'liquid_select',
  'meta_description',
  'placeholder',
  'query_graph',
  'render_featured_items',
  'render_form',
  'select',
  'submit',
  'title',
  'transactable_type_select',
  'will_paginate'
];

const test = new RegExp(`{%-?\\s*(${tags.join('|')})\\s`);
const _message = match => `[DEPRECATED TAG] ${match}`;

const audit = async () => {
  let results = {};
  const files = await glob('{app,modules,marketplace_builder}/**/*.liquid');

  for (let file of files) {
    const fileContents = fs.readFileSync(file, { encoding: 'utf8' });
    const matches = fileContents.match(test);
    const match = (matches && matches[1]) || false;

    if (!match) {
      continue;
    }

    const currentFiles = results[match] && results[match].files;
    const updatedFiles = (currentFiles || []).concat(file);

    results = {
      ...results,
      [match]: {
        files: updatedFiles,
        message: _message(match)
      }
    };
  }

  return results;
};

export { audit, _message as message };
