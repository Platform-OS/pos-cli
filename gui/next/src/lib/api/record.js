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


// purpose:		build the strings and objects needed to pass with GraphQL request to filter the properties
// arguments:	list of properties to filter the data with (array of objects) that icludes:
//				    attribute_type, property, operation, value
// returns:		GraphQL variables definitions, e.g. '($variable_name: String. $another_variable: Int)' (string)
//            variables with their values to pass with the query, e.g. { variable_name: 'Variable value', another_variable: 5 } (object)
//            filters used to filter properties in GraphQL requests, e.g. 'properties: [name: "variable_name", contains: $variable_value]' (string)
// ------------------------------------------------------------------------
const buildPropertiesFilter = (filters = []) => {
  // graphql variables definition for the query (string)
  let variablesDefinition = '';
  // variables passed with the query (object)
  let variables = {};
  // filters passed with the query (string)
  let propertiesFilter = '';
  // list of data types for variables in each operations, unmentioned are considered 'string' (object)
  const operationsForType = {
    string: ['array_contains', 'not_array_contains', 'contains', 'ends_with', 'not_contains', 'not_ends_with', 'not_starts_with', 'not_value', 'starts_with', 'value'],
    int: ['value_int', 'not_value_int'],
    float: ['not_value_float', 'value_float'],
    bool: ['exists', 'not_value_boolean', 'value_boolean'],
    range: ['range'],
    array: ['value_array', 'not_value_array', 'value_in', 'not_value_in', 'array_overlaps', 'not_array_overlaps']
  };
  // type name to be used in graphql variables definition
  const parsedGraphqlType = {
    string: 'String',
    int: 'Int',
    float: 'Float',
    bool: 'Boolean',
    range: 'RangeFilter',
    array: '[String!]'
  };

  for(const filter of filters){

    // if there is no value, don't output filter string for that filter which effectively clears it
    if(!filter.minFilterValue && !filter.value){
      break;
    }

    // storing the type for current filter
    let filterType = '';
    // we are getting each filter value as a string, so it needs to be parsed for graphql request
    let parsedFilterValue = '';

    if(operationsForType.int.includes(filter.operation)){
      filterType = 'int';
      parsedFilterValue = parseInt(filter.value);
    }
    else if (operationsForType.float.includes(filter.operation)){
      filterType = 'float';
      parsedFilterValue = parseFloat(filter.value);
    }
    else if (operationsForType.bool.includes(filter.operation)){
      filterType = 'bool';
      parsedFilterValue = filter.value === 'true' ? true : false;
    }
    else if(operationsForType.range.includes(filter.operation)){
      filterType = 'range';
      parsedFilterValue = {};
      parsedFilterValue[filter.minFilter] = filter.minFilterValue;
      parsedFilterValue[filter.maxFilter] = filter.maxFilterValue;
    }
    else if(operationsForType.array.includes(filter.operation)){
      filterType = 'array';
      parsedFilterValue = JSON.parse(filter.value);
    }
    else {
      filterType = 'string';
      parsedFilterValue = filter.value;
    }

    // add current filter variable to variables definition string
    variablesDefinition += `, $${filter.name}: ${parsedGraphqlType[filterType]}`;

    // add the current filter to the variables object passed with the request (corresponding with variables definition)
    variables[filter.name] = parsedFilterValue;

    // add current filter to properties filters string passed in GraphQL request
    // skipping the ID as it is not filtered as property
    if(filter.name !== 'id'){
      propertiesFilter += `{
        name: "${filter.name}",
        ${filter.operation}: $${filter.name}
      }`;
    }

  };

  // build the final variables definition string with all the needed variables and their types
  if(variablesDefinition.length){
    variablesDefinition = variablesDefinition.slice(2); // remove first comma ', '
    variablesDefinition = `(${variablesDefinition})`; // add brackets to definition string
  }

  // build final string for filtering the properties
  propertiesFilter = `
    properties: [${propertiesFilter}]
  `;

  return { variablesDefinition, variables, propertiesFilter };
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

    const propertiesFilterData = buildPropertiesFilter(params.filters?.attributes);

    const query = `
      query${propertiesFilterData.variablesDefinition} {
        records(
          page: ${params.filters.page}
          per_page: 20,
          sort: { ${sort} },
          filter: {
            ${tableFilter}
            ${idFilter}
            ${deletedFilter}
            ${propertiesFilterData.propertiesFilter}
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

    return graphql({ query, variables: propertiesFilterData.variables }).then(data => { state.data('records', data.records) }); // UPDATED
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
