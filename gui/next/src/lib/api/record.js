/*
  operations on records
*/


// imports
// ------------------------------------------------------------------------
import { graphql } from '$lib/api/graphql';
import { state } from '$lib/state';



// purpose:   maps column types to corresponding property type used in GraphQL string
// ------------------------------------------------------------------------
const columnTypeToPropertyType = {
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

// purpose:		maps column types to corresponding variable type used in GraphQL variables definition
// ------------------------------------------------------------------------
const columnTypeToVariableType = {
  string: 'String',
  integer: 'Int',
  float: 'Float',
  boolean: 'Boolean',
  array: '[String!]',
  json: 'JSONPayload',
  range: 'RangeFilter'
};



// purpose:		build the strings and objects needed to pass with GraphQL request to filter the properties
// arguments:	list of properties to filter the data with (array of objects) that icludes:
//				    attribute_type, property, operation, value
// returns:		GraphQL variables definitions, e.g. '($variable_name: String. $another_variable: Int)' (string)
//            variables with their values to pass with the query, e.g. { variable_name: 'Variable value', another_variable: 5 } (object)
//            filters used to filter properties in GraphQL requests, e.g. 'properties: [name: "variable_name", contains: $variable_value]' (string)
// ------------------------------------------------------------------------
const buildQueryIngredients = (filters = []) => {
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

  // build the data for each applied filter
  for(const filter of filters){

    // if there is no value, don't output filter string for that filter which effectively clears it
    if(!filter.minFilterValue && !filter.maxFilterValue && !filter.value){
      break;
    }

    // storing the type for current filter
    let filterType = '';
    // we are getting each filter value as a string, so it needs to be parsed for graphql request
    let parsedFilterValue = '';

    if(operationsForType.int.includes(filter.operation)){
      filterType = 'integer';
      parsedFilterValue = parseInt(filter.value);
    }
    else if (operationsForType.float.includes(filter.operation)){
      filterType = 'float';
      parsedFilterValue = parseFloat(filter.value);
    }
    else if (operationsForType.bool.includes(filter.operation)){
      filterType = 'boolean';
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

    // skipping the ID as it is not filtered as a property
    if(filter.name !== 'id'){
      // add current filter variable to variables definition string
      variablesDefinition += `, $${filter.name}: ${columnTypeToVariableType[filterType] || 'String'}`;

      // add the current filter to the variables object passed with the request (corresponding with variables definition)
      variables[filter.name] = parsedFilterValue;

      // add current filter to properties filters string passed in GraphQL request
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



// purpose:		builds all the needed data to build and trigger GraphQL mutation
// arguments: FormData object with the column, type and value (column[value], column[type])
// returns:   variablesDefinition (string) - GraphQL variables definitions $variable: Type
//            variables (object) - values for defined variables passed to GraphQL API
//            properties (string) - list of GraphQL properties for given variables to use inside "properties: []"
// ------------------------------------------------------------------------
const buildMutationIngredients = (formData) => {

  // entries from the form (object)
  const formEntries = formData.entries();
  // graphql variables definition for the query (string)
  let variablesDefinition = '';
  // variables passed with the query (object)
  let variables = {};
  // properties list with variables as their value passed with the query (string)
  let properties = '';
  // helper object that will store the column name with all it's corresponding propertiest needed to pass to graphql (object)
  let columns = {};

  // values we are getting from FormData are strings, this will parse them depending on the column type we are taking them from
  function parseValue(type, value){
    if(value === ''){
      return null;
    }

    if(type === 'integer'){
      return parseInt(value);
    }

    if(type === 'float'){
      return parseFloat(value);
    }

    if(type === 'boolean'){
      if(value === 'true'){
        return true;
      } else {
        return false;
      }
    }

    if(type === 'array'){
      return JSON.parse(value);
    }

    if(type === 'json'){
      return JSON.parse(value);
    }

    return value;
  };

  // parse FormData entries to an `columns` object
  for(const [entry, value] of formEntries){
    // do it only for FormData entries related to columns
    if(entry.indexOf('[') >= 0){
      // get the column name from FormData
      let column = entry.slice(0, entry.indexOf('['));
      // get the column properties names like the 'type' and 'value'
      let property = entry.slice(entry.indexOf('[')+1, entry.indexOf(']'));

      // build an object like: column_name = { type: 'type', value: 'value' }
      (columns[column] ??= {})[property] = value;
    }
  };

  // for each edited column build the needed strings and add the value to `variables`
  for(const column in columns){
    variablesDefinition += `, $${column}: ${columnTypeToVariableType[columns[column].type] || 'String'}`;

    variables[column] = parseValue(columns[column].type, columns[column].value);

    properties += `{ name: "${column}", ${columnTypeToPropertyType[columns[column].type]}: $${column} }`;
  }


  // build the final variables definition string with all the needed variables and their types
  if(variablesDefinition.length){
    variablesDefinition = variablesDefinition.slice(2); // remove first comma ', '
    variablesDefinition = `(${variablesDefinition})`; // add brackets to definition string
  }

  return { variablesDefinition, variables, properties }

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
      idFilter = `id: { ${params.filters.attributes[idFilterIndex].operation}: ${params.filters.attributes[idFilterIndex].value} }`;
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

    const propertiesFilterData = buildQueryIngredients(params.filters?.attributes);

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

    return graphql({ query, variables: propertiesFilterData.variables }).then(data => { state.data('records', data.records) });
  },


  // purpose:		creates new record in the database
  // arguments:
  // returns:		id of the newly created record (int)
  // ------------------------------------------------------------------------
  create: (args) => {
    const formDataEntries = Object.fromEntries(args.properties.entries());
    const table = formDataEntries.tableName;
    const ingredients = buildMutationIngredients(args.properties);

    const query = `
      mutation${ingredients.variablesDefinition} {
        record_create(record: {
          table: "${table}",
          properties: [${ingredients.properties}]
        }) {
          id
        }
      }`;

    return graphql({ query, variables: ingredients.variables });
  },


  // purpose:		edits record in the database
  // arguments:	(object)
  //				    tableName (string) - name of the table that you are adding the record in
  //				    id (int) - id of the record to edit
  //				    properties (FormData) - key-value pairs for the record
  // returns:		id of the edited record (int)
  // ------------------------------------------------------------------------
  edit: (args) => {
    let formDataEntries = Object.fromEntries(args.properties.entries());
    const table = formDataEntries.tableName;
    const id = formDataEntries.recordId;
    const ingredients = buildMutationIngredients(args.properties);

    const query = `
      mutation${ingredients.variablesDefinition} {
        record_update(
          id: ${id},
          record: {
            table: "${table}"
            properties: [${ingredients.properties}]
          }
        ) {
          id
        }
      }`;

    return graphql({ query, variables: ingredients.variables });
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
