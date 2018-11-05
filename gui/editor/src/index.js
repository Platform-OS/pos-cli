const editor = require('./editor.js');
const storage = require('./storage.js');
const gateway = require('./gateway.js');

const flash = msg => {
  const dialog = document.getElementById('message');
  dialog.innerHTML = `${new Date()} ${JSON.stringify(msg)}`;
};

const convertButton = document.getElementById('convert');
convertButton.onclick = e => {
  editor.convertToYAML(storage.editor.item.data, document.getElementById('console'), storage.editor.itemType.path.ext);
};

const searchInput = document.getElementById('search');
searchInput.onkeyup = e => {
  storage.menu.search.query = e.target.value;
  window.dispatchEvent(new CustomEvent('search-query-updated', { detail: 'e.target.value' }));
};

window.addEventListener('item-data-changed', e => {
  storage.editor.item.data[e.detail.name] = e.detail.value;
});

const saveButton = document.getElementById('save-item');

saveButton.onclick = event => {
  const body = editor.convertToYAML(
    storage.editor.item.data,
    document.getElementById('console'),
    storage.editor.itemType.path.ext
  );

  const formData = new FormData();
  formData.append('marketplace_builder_file_body', new Blob([body]));

  const path = storage.editor.itemType.path;
  const filename = storage.editor.item.data.path || 'FILENAME';
  formData.append('path', `${path.base}/${filename}.${path.ext}`);

  gateway
    .sync(formData)
    .then(response => {
      // console.log(storage.editor);
      // const name =  storage.editor.item.data.name || storage.editor.item.data.slug;
      // storage.editor.item.name = name;
      flash(response.data);
      window.dispatchEvent(new CustomEvent('items-loaded', { detail: storage.editor.itemType.name }));
    })
    .catch(error => flash(error.data));
};

const reloadItemTypesData = () => {
  return new Promise((resolve, reject) => {
    gateway.getItemTypes().then(response => {
      storage.itemTypes = [];
      storage.itemTypes = [...response.data.data.itemTypes.results]
        .filter(t => t.name != 'Asset')
        .filter(t => t.name != 'ActivityStreamsHandler')
        .filter(t => t.name != 'ActivityStreamsGroupingHandler')
        .filter(t => t.name != 'Translation');

      window.dispatchEvent(new Event('item-types-loaded'));
      resolve('OK');
    }, flash);
  });
};

const loadItemsData = e => {
  if (storage.items.byType(e.detail).length > 0) {
    window.dispatchEvent(new CustomEvent('items-loaded', { detail: e.detail }));
    return;
  }
  gateway.getItems(e.detail).then(response => {
    storage.items.load(response.data.data.items.results);

    window.dispatchEvent(new CustomEvent('items-loaded', { detail: e.detail }));
  });
};

const renderItemTypeList = () => {
  const container = document.getElementById('item-type-list');
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  for (i in storage.itemTypes) {
    let type = storage.itemTypes[i];

    let div = document.createElement('div');
    let label = document.createElement('label');
    let option = document.createElement('input');
    option.type = 'checkbox';
    option.name = `chb-${type.name}`;
    option.value = type.name;
    option.checked = storage.menu.search.itemTypes.has(type.name);

    option.onchange = e => {
      if (e.target.checked) window.dispatchEvent(new CustomEvent('item-type-selected', { detail: type.name }));
      else window.dispatchEvent(new CustomEvent('item-type-deselected', { detail: type.name }));
    };

    const newItemButton = document.createElement('button');
    newItemButton.onclick = event => {
      const name = `new-${type.name.toLowerCase()}`;
      const newItem = { name: name, type: type.name, data: { name: name } };
      storage.items.add(newItem);

      window.dispatchEvent(new CustomEvent('item-selected', { detail: { name: name, type: type.name } }));
    };
    newItemButton.appendChild(document.createTextNode('new'));
    div.appendChild(newItemButton);

    let itemList = document.createElement('div');
    itemList.id = `${type.name}-item-list`;

    label.appendChild(option);
    label.appendChild(document.createTextNode(type.name));
    div.appendChild(label);
    div.appendChild(itemList);

    container.appendChild(div);
  }
};

const renderItemList = ({ detail }) => {
  const list = document.getElementById(`${detail}-item-list`);
  if (!list) return;
  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }

  for (i in storage.items.byType(detail)) {
    let item = storage.items.byType(detail)[i];
    if (storage.menu.search.matches(item)) {
      let selected = item.name == storage.editor.item.name;
      list.appendChild(renderMenuItem(item, selected));
    }
  }
};

window.addEventListener('item-types-loaded', renderItemTypeList);

window.addEventListener('items-loaded', renderItemList);
// window.addEventListener('items-loaded', console.log);

window.addEventListener('item-selected', ({ detail }) => {
  const item = storage.items.byType(detail.type).find(x => x.name == detail.name);
  storage.editor.item = item;
});

window.addEventListener('item-selected', ({ detail }) => {
  const item = storage.itemTypes.find(x => x.name == detail.type);
  storage.editor.itemType = item;
});

window.addEventListener('item-selected', ({ detail }) => {
  renderEditor();
});

const renderMenuItem = ({ name, type, data }, selected = false) => {
  let block = document.createElement('div');
  let label = document.createElement('label');
  let small = document.createElement('div');
  small.classList.add('hint');

  let item = document.createElement('input');
  item.id = `list-item-${type}-${name}`;
  item.type = 'radio';
  item.name = 'menu-item';
  item.value = name;
  item.checked = selected;

  item.onclick = event => {
    window.dispatchEvent(new CustomEvent('item-selected', { detail: { name, type } }));
  };

  label.appendChild(item);
  label.appendChild(document.createTextNode(name));
  small.appendChild(document.createTextNode(type));
  label.appendChild(small);
  block.appendChild(label);
  return block;
};

const button = document.getElementById('reload');
button.onclick = reloadItemTypesData;

window.addEventListener('item-type-selected', ({ detail }) => {
  storage.menu.search.itemTypes = new Set([...storage.menu.search.itemTypes, detail]);
});

window.addEventListener('item-type-deselected', ({ detail }) => {
  storage.menu.search.itemTypes.delete(detail);
});

window.addEventListener('item-type-selected', loadItemsData);
window.addEventListener('item-type-deselected', loadItemsData);
window.addEventListener('search-query-updated', () => {
  storage.menu.search.itemTypes.forEach(type => loadItemsData({ detail: type }));
});

const renderEditor = () => {
  if (storage.editor.item.data) {
    editor.createForm(
      storage.editor.item.data,
      storage.editor.itemType,
      storage.editor.settings,
      document.getElementById('editor-fields')
    );
  }
};

const render = () => {
  reloadItemTypesData().then(() => {
    loadItemsData({ detail: 'EmailNotification' });
    loadItemsData({ detail: 'SmsNotification' });
    loadItemsData({ detail: 'ApiCallNotification' });
    loadItemsData({ detail: 'AuthorizationPolicy' });
    loadItemsData({ detail: 'FormConfiguration' });
    loadItemsData({ detail: 'TransactableType' });
  });
};

render();
