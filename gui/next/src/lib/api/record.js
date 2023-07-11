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
//				attribute_type, property, operation, value
// returns:		GraphQL string with filtering properties (string)
// ------------------------------------------------------------------------
const getFiltersString = (filters) => {
  let filtersString = '';

  const operation_types = {
    string: ['array_contains', 'contains', 'ends_with', 'not_contains', 'not_ends_with', 'not_starts_with', 'not_value', 'not_value_array', 'starts_with', 'value'],
    range: ['range']
  };

  filters.forEach(filter => {

    let parsedValue = '';

    if(operation_types.string.includes(filter.operation)){
      parsedValue = `"${filter.value}"`;
    }
    else if(operation_types.range.includes(filter.operation)){
      parsedValue = `{ ${filter.minFilter}: "${filter.minFilterValue}", ${filter.maxFilter}: "${filter.maxFilterValue}" }`;
    }
    else {
      parsedValue = filter.value;
    }

    // filtering by id is not done in this string
    if(filter.name !== 'id' && parsedValue){
      filtersString += `{
        name: "${filter.name}",
        ${filter.operation}: ${parsedValue}
      }`;
    }

  });

  filtersString = `
    properties: [${filtersString}]
  `;

  return filtersString;
};



const record = {

  // purpose:		gets records from the database for fiven table id
  // arguments:	(object)
  //				id of the table that you need the records for (int)
  //				filters to the graphql query (object)
  //				if you want to get also the deleted items (bool)
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

    const tableFilter = params.table ? `model_schema_id: { value: ${params.table} }` : '';

    const idFilterIndex = params.filters?.attributes?.findIndex(attribute => attribute.name === 'id');

    let idFilter = '';
    if(idFilterIndex >= 0 && params.filters.attributes[idFilterIndex].value){
      idFilter = `id: { ${params.filters.attributes[idFilterIndex].operation}: ${params.filters.attributes[idFilterIndex].value} }`;
    }

    const deletedFilter = params.deleted ? `deleted_at: { exists: true }` : '';

    const filters = params.filters?.attributes ? getFiltersString(params.filters.attributes) : '';

    const query = `
      query {
        models(
          page: ${params.filters.page}
          per_page: 20,
          sort: { created_at: { order: DESC } },
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

    return graphql({ query }).then(data => { state.data('records', data.models) });
  },


  // purpose:		creates new record in the database
  // arguments:	(object)
  //				tableName (string) - name of the table that you are adding the record in
  //				properties (FormData) - key-value pairs for the record
  // returns:		id of the newly created record (int)
  // ------------------------------------------------------------------------
  create: (args) => {
    let properties = Object.fromEntries(args.properties.entries());
    const table = properties.tableName;
    delete properties.tableName;
    properties = getPropertiesString(properties);

    const query = `
      mutation {
        model_create(model: {
          model_schema_name: "${table}",
          properties: [${properties}]
        }) {
          id
        }
      }`;

    return graphql({ query });
  },


  // purpose:		edits record in the database
  // arguments:	(object)
  //				tableName (string) - name of the table that you are adding the record in
  //				id (int) - id of the record to edit
  //				properties (FormData) - key-value pairs for the record
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
        model_update(
          id: ${id},
          model: {
            model_schema_name: "${table}"
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
  //				tableName (string) - name of the table that you are deleting the record from
  //				id (int) - id of the record to delete
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
  }


};



// exports
// ------------------------------------------------------------------------
export { record }