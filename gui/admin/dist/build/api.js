import { I as writable, N as get_store_value } from './main2.js';
import { n as notification } from './store.js';

function send (message, type = 'default', timeout) {
  notification.set({ type, message, timeout });
}

function danger (msg, timeout) {
  send(msg, 'danger', timeout);
}

function success (msg, timeout) {
  send(msg, 'success', timeout);
}

const createStore$1 = () => {
  const { subscribe, set, update } = writable({});
  return {
    subscribe,
    set,
    update,
    reset: () => {
      set({});
    }
  };
};
var filtersStore = createStore$1();

var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
const createStore = () => {
  const { subscribe, set, update } = writable({ page: 1 });
  return {
    subscribe,
    set,
    update,
    setPaginationData: ({ total_entries, total_pages }) => {
      update((s) => {
        return __spreadProps(__spreadValues({}, s), { total_entries, total_pages });
      });
    },
    setSchemaId: (id) => {
      update((s) => __spreadProps(__spreadValues({}, s), { schemaId: id }));
    },
    reset: () => update((s) => __spreadProps(__spreadValues({}, s), { page: 1 })),
    increment: () => {
      update((s) => {
        const page = s.page + 1;
        return __spreadProps(__spreadValues({}, s), { page });
      });
    },
    decrement: () => {
      update((s) => {
        const page = s.page - 1 || 1;
        return __spreadProps(__spreadValues({}, s), { page });
      });
    }
  };
};
var pageStore = createStore();

var typeMap = {
  array: "value_array",
  boolean: "value_boolean",
  date: "value",
  datetime: "value",
  float: "value_float",
  integer: "value_int",
  string: "value",
  text: "value",
  upload: "value"
};

const getPropsString = (props) => {
  return Object.keys(props).map((prop) => {
    const { name, value, attribute_type } = props[prop];
    const updateType = typeMap[attribute_type];
    return `{ name: "${name}", ${updateType}: ${value}}`;
  }).join("\n");
};
const getPropertiesFilter = (f) => {
  const filterString = `
    properties: [{
      name: "${f.property}"
      ${f.operation}: ${f.value}
    }]
  `;
  return filterString;
};
const graph = (body, successMessage = "Success") => {
  return fetch(`http://localhost:${parseInt(window.location.port)-1}/api/graph`, {
    headers: { "Content-Type": "application/json" },
    method: "POST",
    body: JSON.stringify(body)
  }).then((res) => res.json()).then((res) => {
    if (res.errors) {
      const err = res.errors[0].message;
      return danger(`Error: ${err}`, 5e3);
    } else {
      if (successMessage !== false) {
        success(successMessage);
      }
    }
    return res && res.data;
  });
};
var api = {
  getModelSchemas(id) {
    const filter = id ? `filter: { id: { value: ${id} } }` : "";
    const query = `query {
      admin_model_schemas(
          per_page: 100
          ${filter}
        ) {
        results {
          id
          name
          properties {
            name
            attribute_type
          }
        }
      }
    }`;
    return graph({ query }, false).then((data) => data.admin_model_schemas.results);
  },
  getModels({ schemaId, id, page = 1, deleted = false }) {
    const f = get_store_value(filtersStore);
    let propertyFilter = "";
    if (f.property && f.operation && f.type) {
      propertyFilter = getPropertiesFilter(f);
    }
    const deletedFilter = deleted ? `deleted_at: { exists: true }` : "";
    const idFilter = id ? `id: { value: ${id} }` : "";
    const schemaIdFilter = schemaId ? `model_schema_id: { value: ${schemaId} }` : "";
    const query = `query {
      models(
        page: ${page}
        per_page: 20,
        sort: { created_at: { order: DESC } },
        filter: {
          ${schemaIdFilter}
          ${idFilter}
          ${deletedFilter}
          ${propertyFilter}
        }
      ) {
        total_pages
        results {
          id
          created_at
          updated_at
          deleted_at
          properties
        }
      }
    }`;
    return graph({ query }, false).then((data) => {
      if (data && data.models) {
        pageStore.setPaginationData({ total_pages: data.models.total_pages });
      }
      return data.models.results;
    });
  },
  updateModel({ id, props }) {
    const properties = getPropsString(props);
    const query = `
      mutation {
        model_update(
          id: ${id},
          model: {
            properties: [${properties}]
          }
        ) {
          id
        }
      }`;
    return graph({ query });
  },
  deleteModel(id) {
    const query = `mutation {
      model_delete(id: ${id}) {
        id
      }
    }`;
    return graph({ query });
  },
  undeleteModel(id) {
    const query = `
      mutation {
        model_update(
          id: ${id},
          model: { deleted_at: null }
        ) {
          id
        }
      }`;
    return graph({ query });
  },
  createModel(schemaName, props) {
    const properties = getPropsString(props);
    const query = `mutation {
      model_create(model: {
        model_schema_name: "${schemaName}",
        properties: [${properties}]
      }) {
        id
      }
    }`;
    return graph({ query });
  },
  getUsers(email = "", fn = "", ln = "") {
    const query = `query getUsers {
      users(per_page: 20,
        page: 1,
        filter: {
          email: { contains: "${email}" },
          first_name: { contains: "${fn}" },
          last_name: { contains: "${ln}" }
        }
      ) {
        results {
          id
          email
          deleted_at
          created_at
          first_name
          last_name
          external_id
          jwt_token
          temporary_token
        }
      }
    }`;
    return graph({ query }, false);
  },
  getLogs() {
    return fetch(`http://localhost:${parseInt(window.location.port)-1}/api/logs`).then((res) => res.json());
  },
  getConstants() {
    const query = `query getConstants {
      constants(per_page: 99) {
        results { name, value, updated_at }
      }
    }`;
    return graph({ query }, false);
  },
  setConstant(name, value) {
    const query = `mutation {
      constant_set(name: "${name}", value: "${value}") {
        name, value
      }
    }`;
    return graph({ query }, "Constant updated");
  },
  unsetConstant(name) {
    const query = `mutation {
      constant_unset(name: "${name}") {
        name
      }
    }`;
    return graph({ query }, "Constant unset");
  }
};

export { api as a, filtersStore as f, pageStore as p };
