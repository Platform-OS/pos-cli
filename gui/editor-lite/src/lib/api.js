import { NotificationDisplay, notifier } from '@beyonk/svelte-notifications';
import { get } from 'svelte/store';
import filtersStore from '../pages/Models/Manage/_filters-store';

import typeMap from './_typemap';

let timeout = 5000;

const getPropsString = (props) => {
  return Object.keys(props)
    .map((prop) => {
      const { name, value, attribute_type } = props[prop];

      const updateType = typeMap[attribute_type];
      const val = attribute_type === 'string' ? `"${value}"` : value;

      return `{ name: "${name}", ${updateType}: ${val}}`;
    })
    .join('\n');
};

const getPropertiesFilter = f => {
  const filterString = `
    properties: [{
      name: "${f.property}"
      ${f.operation}: ${f.value}
    }]
  `;

  return filterString;
}

const graph = (body) => {
  return fetch('http://localhost:3333/api/graph', {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify(body),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.errors) {
        const err = res.errors[0].message;
        return notifier.danger(`Error: ${err}`, 10000);
      }

      return res && res.data;
    });
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

    return graph({ query }).then((data) => data.admin_model_schemas.results);
  },
  getModels({ schemaId, id, deleted = false }) {
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
        per_page: 20,
        sort: { created_at: { order: DESC } },
        filter: {
          ${schemaIdFilter}
          ${idFilter}
          ${deletedFilter}
          ${propertyFilter}
        }
      ) {
        results {
          id
          created_at
          updated_at
          deleted_at
          properties
        }
      }
    }`;

    return graph({ query }).then((data) => data.models.results);
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
  createModel(name, props) {
    const properties = getPropsString(props);

    const query = `mutation {
      model_create(model: {
        model_schema_name: "${name}",
        properties: [${properties}]
      }) {
        id
      }
    }`;

    return graph({ query });
  },
};
