const fs = require('fs');
const glob = require('tiny-glob');

// TODO: Cleanup after old stack is dead
const filters = [
  'active_class',
  'already_favorite',
  'attachments_visible_for',
  'connections_for',
  'connections_tooltip',
  'custom_sanitize',
  'custom_sanitizer',
  'filter_text',
  'find_collaborator',
  'find_collaborators_for_user_transactables',
  'find_collaborators_for_user',
  'generate_url_with_user_token',
  'generate_url',
  'get_ckeditor_assets',
  'get_data_contents',
  'get_enquirer_confirmed_orders',
  'get_enquirer_draft_orders',
  'get_enquirer_orders',
  'get_lister_orders',
  'get_lowest_price_with_options',
  'get_payment_gateway_id',
  'group_rules_by_day',
  'image_url',
  'is_approved_collaborator',
  'is_user_following',
  'is_visible',
  'location_path',
  'lowest_full_price_with_cents_with_currency',
  'lowest_full_price_without_cents_with_currency',
  'lowest_price_with_cents_with_currency',
  'lowest_price_without_cents_with_currency',
  'meta_attr',
  'number_of_minutes_to_time',
  'number_of_minutes_until',
  'pagination_links',
  'parse_time_with_format',
  'parse_time',
  'parse_to_minute',
  'price_with_cents_with_currency_as_cost',
  'price_with_cents_with_currency',
  'price_without_cents_with_currency',
  'pricing_units_translation',
  'query',
  'render_price',
  'request_parameter',
  'search_box_for',
  'search_button_for',
  'shorten_url',
  'soft_concat',
  'space_listing_placeholder_path',
  'strip_tags',
  'tag_filter_link',
  'timeago',
  'to_money',
  'to_time_from_str',
  'total_entries',
  'translate_property',
  'user_message_create_path',
  'widget_links'
];

const test = new RegExp(`\\| (${filters.join('|')})`);
const _message = match => `[DEPRECATED FILTER] ${match}`;

module.exports = {
  audit: async () => {
    let results = {};
    const files = await glob('**/*.liquid', {
      filesOnly: true
    });

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
  },
  message: _message
};
