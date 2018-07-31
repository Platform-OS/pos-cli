const request = require('axios');

ROUTING = {
  sync: '/api/marketplace_builder/marketplace_releases/sync',
  graph: '/api/graph'
};

module.exports = {
  sync: form =>
    request({
      method: 'PUT',
      url: ROUTING.sync,
      data: form
    }),

  getItems(type) {
    const query = `{ items: cms_items(type: ${type}) { results { type name: resource_name data }}}`;
    return this.graph(query);
  },

  getItemTypes() {
    const query = '{ itemTypes: cms_discovery { results { name  path  fields  }}}';
    return this.graph(query);
  },

  graph: query => {
    const csrf = document.querySelector('#csrf-token');
    const csrfToken = csrf ? csrf.dataset.csrfToken : '';

    return request({
      method: 'POST',
      url: ROUTING.graph,
      headers: {
        'X-CSRF-Token': csrfToken
      },
      data: { query: query }
    });
  }
};
