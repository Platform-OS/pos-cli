const defaultInput = {
  type: 'input',
  format: 'text'
};

const getOptions = name => storage.items.byType(name).map(x => x.name);

const storage = {
  items: {
    add: item => (storage.items.data = [...storage.items.data, item]),
    load: items => (storage.items.data = [...storage.items.data, ...items]), // uniqueness
    byType: type => storage.items.data.filter(i => i.type == type),
    data: []
  },
  itemTypes: [],
  menu: {
    search: {
      matches: item => storage.menu.search.itemTypes.has(item.type) && (item.name || '').match(storage.menu.search.query),
      itemTypes: new Set(),
      query: ''
    }
  },
  editor: {
    item: {},
    settings: {
      find: fieldName => {
        const field = storage.editor.settings.fields[fieldName] || defaultInput;

        if (!field.source) return field;

        return {
          type: field.type,
          options: getOptions(field.source),
          format: field.format,
          source: field.source
        };
      },
      fields: {
        content: { type: 'textarea', format: 'liquid' },
        body: { type: 'textarea', format: 'liquid' },
        default_payload: { type: 'textarea', format: 'text' },
        configuration: { type: 'textarea', format: 'yaml' },
        callback_actions: { type: 'textarea' },
        async_callback_actions: { type: 'textarea', format: 'yaml' },
        custom_attributes: { type: 'textarea', format: 'yaml' },
        metadata: { type: 'textarea', format: 'yaml' },
        filter: { type: 'textarea', format: 'yaml' },
        targets: { type: 'textarea', format: 'yaml' },
        authorization_policies: {
          type: 'check_boxes',
          source: 'AuthorizationPolicy'
        },
        email_notifications: {
          type: 'check_boxes',
          source: 'EmailNotification'
        },
        api_call_notifications: {
          type: 'check_boxes',
          source: 'ApiCallNotification'
        },
        sms_notifications: {
          type: 'check_boxes',
          source: 'SmsNotification'
        },
        transactable_types: {
          type: 'check_boxes',
          source: 'TransactableType'
        }
      }
    }
  }
};

module.exports = storage;
