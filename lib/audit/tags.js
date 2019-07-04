const rules = [
  'cache_for',
  'content_holder_tag_for_path',
  'content_holder',
  'dropdown_menu_block',
  'error',
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
  'render_featured_items',
  'render_form',
  'select',
  'submit',
  'title',
  'transactable_type_select',
  'will_paginate',
  'query_graph',
  'execute_query'
];

const processRules = (val, message) => {
  return {
    glob: '{views,authorization_policies,form_configurations,notifications}/**/*.liquid',
    test: val,
    message: message
  };
};

module.exports = {
  getRules: () => rules.map(val => processRules(`{%-?\\s*${val}.*-?%}`, `Deprecated "${val}" tag found.`))
};