/*
  handles managing users
*/


// imports
// ------------------------------------------------------------------------
import { graphql, graphqlData } from '#lib/api/graphql';
import { buildMutationIngredients } from '#lib/helpers/buildMutationIngredients';

const user = {

  // purpose:		gets users from the database
  // arguments:	filters (object)
  //				  attribute to filter by ('email' or 'id')
  //				  value to filter with (string)
  //				  page (int)
  //				options (object), with fetch to use, such as the one a load function receives
  // returns:		users page as it appears in the database (object)
  // ------------------------------------------------------------------------
  get: async (filters = {}, options) => {
    // these are written into the query text and can come from a url, so the attribute is
    // one of the two names, the page a number and the value a quoted, escaped string
    const attribute = filters.attribute === 'id' ? 'id' : 'email';
    const page = parseInt(filters.page) > 0 ? parseInt(filters.page) : 1;
    const value = filters.value ? JSON.stringify(String(filters.value)) : '';

    let filtersString = '';
    let details = '';

    if(value){
      if(attribute === 'email'){
        filtersString += `email: { contains: ${value} }`;
      } else {
        filtersString += `id: { value: ${value} }`;
      }

      if(attribute === 'id'){
        details = `
          deleted_at
          created_at
          external_id
          jwt_token
          temporary_token
          name
          first_name
          middle_name
          last_name
          slug
          language
        `;
      }
    }

    const query = `
      query {
        users(
          page: ${page}
          per_page: 50
          sort: { id: { order: DESC } }
          filter: {
            ${filtersString}
          }
        ) {
          current_page
          total_pages
          results {
            id
            email
            ${details}
            properties
          }
        }
      }`;

    return graphqlData({ query }, options).then(data => data.users);
  },

  // purpose:		delete users from the database
  // arguments:	
  //				id of the user (int)
  // ------------------------------------------------------------------------
  delete: async (id) => {
    const query = `
      mutation {
        user_delete(id: ${JSON.stringify(String(id))}){ id }
      }
    `;

    return graphql({ query }, false);
  },

  // purpose:		creates a new user
  // arguments:	
  //				properties: object containing first_name, last_name, properties
  //        returns: id of the new user
  // ------------------------------------------------------------------------
  create: async (email, password, properties) => {
    const ingredients = buildMutationIngredients(properties);
    // what was typed is written into the query text, so each value is a quoted, escaped string
    // (not a variable: the custom properties already take theirs from their own names)
    const userQuery = `
      mutation${ingredients.variablesDefinition} {
        user: user_create(user: { email: ${JSON.stringify(String(email))}, password: ${JSON.stringify(String(password))}, properties: [${ingredients.properties}] }) {
          id
        }
      }
    `;
    
    return graphql({ query: userQuery, variables: ingredients.variables }, false);
  },

  // purpose:		edits a user
  // arguments:	
  //        id: id of the user to modify
  //        email: email of the user
  //				properties: object containing additional custom properties
  //        returns: id of the new user
  // ------------------------------------------------------------------------
  edit: async (id, email, properties) => {
    const ingredients = buildMutationIngredients(properties);
    const userQuery = `
      mutation${ingredients.variablesDefinition} {
        user_update(user: { email: ${JSON.stringify(String(email))}, properties: [${ingredients.properties}] }, id: ${JSON.stringify(String(id))}) {
          id
        }
      }
    `;
    
    return graphql({ query: userQuery, variables: ingredients.variables }, false);
  },

  // purpose:		returns custom properies of the user schema
  // arguments:	
  //        returns: list of properties
  // ------------------------------------------------------------------------
  getCustomProperties: async () => {
    const propertiesQuery = `
      query {
        admin_user_schema {
          properties {
            attribute_type
            name
          }
        }
      }
    `;

    return graphqlData({ query: propertiesQuery }, false).then(data => data.admin_user_schema.properties);
  }
};



// exports
// ------------------------------------------------------------------------
export { user };
