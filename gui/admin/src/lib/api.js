import { NotificationDisplay, notifier } from '@beyonk/svelte-notifications';
import { get } from 'svelte/store';
import filtersStore from '../pages/Models/Manage/_filters-store';
import pageStore from '../pages/Models/Manage/_page-store';

import typeMap from './_typemap';

let timeout = 5000;

const getPropsString = (props) => {
  return Object.keys(props)
    .map((prop) => {
      const { name, value, attribute_type } = props[prop];

      const updateType = typeMap[attribute_type];

      return `{ name: "${name}", ${updateType}: ${value}}`;
    })
    .join('\n');
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
  return fetch('http://localhost:3333/api/graph', {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify(body),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.errors) {
        const err = res.errors[0].message;
        return notifier.danger(`Error: ${err}`, 5000);
      } else {
        if (successMessage !== false) {
          notifier.success(successMessage);
        }
      }

      return res && res.data;
    })
};

export default {
  getModelSchemas(id) {
    const filter = id ? `filter: { id: { value: ${id} } }` : '';

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
    const f = get(filtersStore);
    let propertyFilter = '';
    if (f.property && f.operation && f.type) {
      propertyFilter = getPropertiesFilter(f);
    }

    const deletedFilter = deleted ? `deleted_at: { exists: true }` : '';
    const idFilter = id ? `id: { value: ${id} }` : '';
    const schemaIdFilter = schemaId ? `model_schema_id: { value: ${schemaId} }` : '';
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
    return fetch('http://localhost:3333/api/logs').then(res => res.json());
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
