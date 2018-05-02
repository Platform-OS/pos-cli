const yaml = require('js-yaml');

const convertToYAML = (data, output, type) => {
  const dump = Object.assign({}, data);
  delete dump.body;
  delete dump.content;
  const metadata = yaml.safeDump(dump);

  if (type == 'yml') value = metadata;
  else value = `---\n${metadata}---\n${data.body || data.content}`;

  output.value = value;
  return value;
};

const createForm = (data, itemType, settings, dom) => {
  while (dom.firstChild) {
    dom.removeChild(dom.firstChild);
  }

  const fields = itemType.fields;
  for (i in fields) {
    let label = document.createElement('label');
    let key = fields[i];

    label.appendChild(document.createTextNode(key));

    let source = settings.find(key).source;
    if (source) {
      const button = document.createElement('button');
      button.value = source;
      button.appendChild(document.createTextNode('>>'));
      button.onclick = event => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('item-type-selected', { detail: source }));
      };
      // hide for now
      // label.appendChild(button);
    }

    const input = inputFieldFactory.create(key, data[key], settings.find(key));

    label.appendChild(input);
    dom.appendChild(label);
  }
};

const inputFieldFactory = {
  create: (key, value, inputType) => {
    return inputFieldFactory[inputType.type](key, value, inputType);
  },

  input: (key, value, inputType) => {
    const input = document.createElement(inputType.type);
    input.id = `input-${key}`;
    input.name = key;
    input.value = value;
    input.type = 'text';

    if (typeof value === 'undefined') input.value = '';

    input.onkeyup = event => {
      const value = event.target.value;

      window.dispatchEvent(new CustomEvent('item-data-changed', { detail: { name: event.target.name, value: value } }));
    };

    return input;
  },

  textarea: (key, value, inputType) => {
    const input = document.createElement(inputType.type);
    input.id = `input-${key}`;
    input.name = key;

    switch (inputType.format) {
      case 'liquid':
        input.value = value || '';
        break;
      case 'json':
        input.value = JSON.stringify(value, null, 2);
        break;
      case 'yaml':
      case 'yml':
        input.value = yaml.safeDump(value || []);
        break;
      default:
        input.value = value || '';
    }

    input.onkeyup = event => {
      switch (inputType.format) {
        case 'json':
          value = JSON.parse(input.value);
          break;
        case 'yaml':
          value = yaml.load(input.value);
          break;
        default:
          value = input.value;
      }

      window.dispatchEvent(new CustomEvent('item-data-changed', { detail: { name: event.target.name, value: value } }));
    };

    return input;
  },

  select: (key, value, inputType) => {
    const input = document.createElement('select');
    input.id = `input-${key}`;
    input.name = key;
    input.multiple = 'multiple';

    for (i in inputType.options) {
      let t = inputType.options[i];
      let option = document.createElement('option');
      option.value = t;
      option.selected = value && value.indexOf(t) != -1;

      option.appendChild(document.createTextNode(t));
      input.appendChild(option);
    }

    input.onchange = event => {
      const value = [...event.target.options].filter(x => x.selected).map(x => x.value);
      window.dispatchEvent(new CustomEvent('item-data-changed', { detail: { name: event.target.name, value: value } }));
    };

    return input;
  },

  check_boxes: (key, value, inputType) => {
    const box = document.createElement('div');

    for (i in inputType.options) {
      let div = document.createElement('div');
      let label = document.createElement('label');
      let input = document.createElement('input');
      input.type = 'checkbox';
      input.name = key;

      let t = inputType.options[i];
      input.value = t;
      input.checked = value && value.indexOf(t) != -1;

      label.appendChild(input);
      label.appendChild(document.createTextNode(t));
      div.appendChild(label);
      box.appendChild(div);

      input.onchange = event => {
        const value = [...document.getElementsByName(key)].filter(x => x.checked).map(x => x.value);
        window.dispatchEvent(new CustomEvent('item-data-changed', { detail: { name: event.target.name, value: value } }));
      };
    }
    return box;
  }
};

module.exports = { convertToYAML, createForm };
