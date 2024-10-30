/*
  handles managing users
*/


// imports
// ------------------------------------------------------------------------
import { graphql } from '$lib/api/graphql';



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
          properties
        `;
      }
    }

    const query = `
      query {
        users(
          page: ${filters?.page ?? 1}
          per_page: 50
          sort: { id: { order: ASC } }
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
          }
        }
      }`;

    return graphql({ query }, false).then(data => data.users );
  }

};



// exports
// ------------------------------------------------------------------------
export { user }
