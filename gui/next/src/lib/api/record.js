/*
  operations on records
*/


// imports
// ------------------------------------------------------------------------
import JSON5 from 'json5'

import { tryParseJSON } from '$lib/tryParseJSON.js';
import { graphql } from '$lib/api/graphql';
import { state } from '$lib/state';




// purpose:		maps GraphQL types to corresponding GraphQL type query
// ------------------------------------------------------------------------
const typeMap = {
  array: 'value_array',
  boolean: 'value_boolean',
  date: 'value',
  datetime: 'value',
  float: 'value_float',
  integer: 'value_int',
  string: 'value',
  text: 'value',
  upload: 'value',
  json: 'value_json'
};


// purpose:		builds properties string from FormData to pass to GraphQL
// arguments:	FormData properties serialized to object (object) - Object.fromEntries(<FormData>.entries())
// returns:		GraphQL string with properties (string)
// ------------------------------------------------------------------------
const getPropertiesString = (props) => {

  let output = {};

  Object.keys(props)
  .forEach((prop) => {

    let property = prop.slice(0, prop.indexOf('['));
    let key = prop.slice(prop.indexOf('[')+1, prop.indexOf(']'));

    (output[property] ??= {})[key] = props[prop];
  });

  let string = '';

  Object.keys(output).forEach(key => {
    // we are showing escaped JSONs as indented tree, so we need to remove new line signs and indentation when saved
    if(output[key].type === 'string' && tryParseJSON(output[key].value)){
      output[key].value = JSON.stringify(JSON.parse(output[key].value));
    }

    if(output[key].type === 'string' || output[key].type === 'text' || output[key].type === 'date' || output[key].type === 'time' || output[key].type === 'datetime'){
      output[key].value = JSON.stringify(output[key].value);
    }

    // so if this is a true JSON we expect to send it to GraphQL api like a JS-object but in a string
    // that's why it needs to be parsed from editing JSON {"something": "something"} to {something: "something"}
    if(output[key].type === 'json'){
      output[key].value = JSON5.stringify(JSON.parse(output[key].value), { quote: '"' });
    }

    if(!output[key].value){
      output[key].value = null;
    }

    // don't allow editing the upload property but allow any other
    if(output[key].type !== 'upload'){
      string += `{ name: "${key}", ${typeMap[output[key].type]}: ${output[key].value} }`;
    }
  });

  return string;
};


// purpose:		build the filters string to pass to GraphQL
// arguments:	list of attributes to filter the data with (array of objects) that icludes:
//				    attribute_type, property, operation, value
// returns:		GraphQL string with filtering properties (string)
// ------------------------------------------------------------------------
const getFiltersString = (filters) => {
  let filtersString = '';
  let variablesDefinition = '';
  let variables = {};

  const operation_types = {
    string: ['array_contains', 'not_array_contains', 'contains', 'ends_with', 'not_contains', 'not_ends_with', 'not_starts_with', 'not_value', 'starts_with', 'value'],
    int: ['value_int', 'not_value_int'],
    float: ['not_value_float', 'value_float'],
    bool: ['exists', 'not_value_boolean', 'value_boolean'],
    range: ['range'],
    array: ['value_array', 'not_value_array', 'value_in', 'not_value_in', 'array_overlaps', 'not_array_overlaps']
  };

  filters.forEach(filter => {
    let parsedValue = '';

    if(operation_types.int.includes(filter.operation)){
      parsedValue = parseInt(filter.value);
    }
    else if (operation_types.float.includes(filter.operation)){
      parsedValue = parseFloat(filter.value);
    }
    else if (operation_types.bool.includes(filter.operation)){
      parsedValue = filter.value === 'true' ? true : false;
    }
    else if(operation_types.range.includes(filter.operation)){
      parsedValue = {};
      parsedValue[filter.minFilter] = filter.minFilterValue;
      parsedValue[filter.maxFilter] = filter.maxFilterValue;
    }
    else if(operation_types.array.includes(filter.operation)){
      parsedValue = JSON.parse(filter.value);
    }
    else {
      parsedValue = filter.value;
    }

    // filtering by id is not done in this string
    // NEW
    const variableTypeDependingOnOperation = {
      exists: 'Boolean',
      value_boolean: 'Boolean',
      not_value_boolean: 'Boolean',
      value_int: 'Int',
      not_value_int: 'Int',
      not_value_float: 'Float',
      range: 'RangeFilter',
      value_float: 'Float',
      value_array: '[String!]',
      not_value_array: '[String!]',
      value_in: '[String!]',
      not_value_in: '[String!]',
      array_overlaps: '[String!]',
      not_array_overlaps: '[String!]'
    };

    variables[filter.name] = parsedValue;

    variablesDefinition += `, $${filter.name}: ${variableTypeDependingOnOperation[filter.operation] || 'String'}`; // NEW
    if(filter.name !== 'id'){
      filtersString += `{
        name: "${filter.name}",
        ${filter.operation}: $${filter.name}
      }`; // UPDATED
    }

  });

  variablesDefinition = variablesDefinition.slice(2); // remove first comma ', '
  variablesDefinition = variablesDefinition.length && `(${variablesDefinition})`; // add brackets to definition string


  filtersString = `
    properties: [${filtersString}]
  `;

  return { filtersString, variablesDefinition, variables };
};



const record = {

  // purpose:		gets records from the database for fiven table id
  // arguments:	(object)
  //				    id of the table that you need the records for (int)
  //				    filters to the graphql query (object)
  //				    if you want to get also the deleted items (bool)
  // returns:		array of records as they appear in the database (array)
  // ------------------------------------------------------------------------
  get: (args) => {
    const defaults = {
      deleted: false,
      filters: {
        page: 1
      }
    };
    const params = {...defaults, ...args};

    const tableFilter = params.table ? `table_id: { value: ${params.table} }` : '';

    const idFilterIndex = params.filters?.attributes?.findIndex(attribute => attribute.name === 'id');

    let idFilter = '';
    if(idFilterIndex >= 0 && params.filters.attributes[idFilterIndex].value){
      idFilter = `id: { ${params.filters.attributes[idFilterIndex].operation}: $id }`;
    }

    let sort = '';
    if(params.sort){
      if(params.sort.by === 'id' || params.sort.by === 'created_at' || params.sort.by === 'updated_at'){
        sort = `${params.sort.by}: { order: ${params.sort.order} }`;
      } else {
        sort = `properties: { name: "${params.sort.by}", order: ${params.sort.order} }`;
      }
    } else {
      sort = `created_at: { order: DESC }`;
    }

    const deletedFilter = params.deleted === 'true' ? `deleted_at: { exists: true }` : '';

    const filters = params.filters?.attributes ? getFiltersString(params.filters.attributes).filtersString : '';
    const variablesDefinition = params.filters?.attributes && getFiltersString(params.filters.attributes).variablesDefinition || ''; // NEW
    const variables = params.filters?.attributes && getFiltersString(params.filters.attributes).variables;

    const query = `
      query${variablesDefinition} {
        records(
          page: ${params.filters.page}
          per_page: 20,
          sort: { ${sort} },
          filter: {
            ${tableFilter}
            ${idFilter}
            ${deletedFilter}
            ${filters}
          }
        ) {
          current_page
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

    return graphql({ query, variables }).then(data => { state.data('records', data.records) }); // UPDATED
  },


  // purpose:		creates new record in the database
  // arguments:	(object)
  //				    tableName (string) - name of the table that you are adding the record in
  //				    properties (FormData) - key-value pairs for the record
  // returns:		id of the newly created record (int)
  // ------------------------------------------------------------------------
  create: (args) => {
    let properties = Object.fromEntries(args.properties.entries());
    const table = properties.tableName;
    delete properties.tableName;
    properties = getPropertiesString(properties);

    const query = `
      mutation {
        record_create(record: {
          table: "${table}",
          properties: [${properties}]
        }) {
          id
        }
      }`;

    return graphql({ query });
  },


  // purpose:		edits record in the database
  // arguments:	(object)
  //				    tableName (string) - name of the table that you are adding the record in
  //				    id (int) - id of the record to edit
  //				    properties (FormData) - key-value pairs for the record
  // returns:		id of the edited record (int)
  // ------------------------------------------------------------------------
  edit: (args) => {
    let properties = Object.fromEntries(args.properties.entries());
    const table = properties.tableName;
    delete properties.tableName;
    const id = properties.recordId;
    delete properties.recordId;
    properties = getPropertiesString(properties);

    const query = `
      mutation {
        record_update(
          id: ${id},
          record: {
            table: "${table}"
            properties: [${properties}]
          }
        ) {
          id
        }
      }`;

    return graphql({ query });
  },


  // purpose:		deletes record in the database
  // arguments:	(object)
  //				    tableName (string) - name of the table that you are deleting the record from
  //				    id (int) - id of the record to delete
  // returns:		id of the deleted record (int)
  // ------------------------------------------------------------------------
  delete: (args) => {
    let properties = Object.fromEntries(args.properties.entries());
    const table = properties.tableName;
    const id = properties.recordId;

    const query = `
      mutation {
        record_delete(table: "${table}", id: ${id}) {
          id
        }
      }`;

    return graphql({ query });
  },


  // purpose:		restores record from the deleted state back to the fresh
  // arguments:	(object)
  //				    tableName (string) - name of the table that you are deleting the record from
  //				    id (int) - id of the record to delete
  // returns:		id of the deleted record (int)
  // ------------------------------------------------------------------------
  restore: (args) => {
    let properties = Object.fromEntries(args.properties.entries());
    const table = properties.tableName;
    const id = properties.recordId;

    const query = `
      mutation {
        record_update(
          id: ${id},
          record: {
            table: "${table}",
            deleted_at: null
          }
        ) {
          id
        }
      }`;

    return graphql({ query });
  }

};



// exports
// ------------------------------------------------------------------------
export { record }
