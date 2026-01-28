
// purpose:   maps column types to corresponding property type used in GraphQL string
// ------------------------------------------------------------------------
export const columnTypeToPropertyType = {
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
export const columnTypeToVariableType = {
  string: 'String',
  integer: 'Int',
  float: 'Float',
  boolean: 'Boolean',
  array: '[String!]',
  json: 'JSONPayload',
  range: 'RangeFilter'
};

// purpose:		builds all the needed data to build and trigger GraphQL mutation
// arguments: FormData object with the column, type and value (column[value], column[type])
// returns:   variablesDefinition (string) - GraphQL variables definitions $variable: Type
//            variables (object) - values for defined variables passed to GraphQL API
//            properties (string) - list of GraphQL properties for given variables to use inside "properties: []"
// ------------------------------------------------------------------------
export const buildMutationIngredients = (formData) => {

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

  return { variablesDefinition, variables, properties };

};