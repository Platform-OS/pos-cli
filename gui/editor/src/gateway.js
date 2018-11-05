const axios = require('axios');

const ROUTING = {
  sync: '/api/marketplace_builder/marketplace_releases/sync',
  graph: '/api/graph'
};

module.exports = {
  sync: data => axios.put(ROUTING.sync, data),

  getItems(type) {
    const query = `{ items: cms_items(type: ${type}) { results { type name: resource_name data }}}`;
    return this.graph(query);
  },

  getItemTypes() {
    const query = '{ itemTypes: cms_discovery { results { name  path  fields  }}}';
    return this.graph(query);
  },

  graph: query => {
    return axios.post(ROUTING.graph, { query: query });
  }
};
