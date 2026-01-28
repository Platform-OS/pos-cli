/*
  handles managing users
*/


// imports
// ------------------------------------------------------------------------
import { graphql } from '$lib/api/graphql';
import { buildMutationIngredients } from '$lib/helpers/buildMutationIngredients';

const user = {

  // purpose:		gets users from the database
  // arguments:	properties to filter (object)
  //				id of the user (int)
  //				email (string)
  //				first_name (string)
  //				last_name (string)
  //				page (int)
  // returns:		array of users as they appear in the database (array of objects)
  // ------------------------------------------------------------------------
  get: async (filters = {}) => {
    let filtersString = '';
    let details = '';

    if(filters.value){
      if(filters.attribute === 'email'){
        filtersString += `${filters.attribute}: { contains: "${filters.value}" }`;
      } else {
        filtersString += `${filters.attribute}: { value: "${filters.value}" }`;
      }

      if(filters?.attribute === 'id' && filters?.value){
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
          page: ${filters?.page ?? 1}
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

    return graphql({ query }, false).then(data => data.users );
  },

  // purpose:		delete users from the database
  // arguments:	
  //				id of the user (int)
  // ------------------------------------------------------------------------
  delete: async (id) => {
    const query = `
      mutation {
        user_delete(id: ${id}){ id }
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
    const userQuery = `
      mutation${ingredients.variablesDefinition} {
        user: user_create(user: { email: "${email}", password: "${password}", properties: [${ingredients.properties}] }) {
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
        user_update(user: { email: "${email}",  properties: [${ingredients.properties}] }, id: ${id}) {
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

    return graphql({ query: propertiesQuery }, false).then(data => data.admin_user_schema.properties);
  }
};



// exports
// ------------------------------------------------------------------------
export { user };
