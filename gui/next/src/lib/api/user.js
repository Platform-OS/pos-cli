/*
  handles managing users
*/


// imports
// ------------------------------------------------------------------------
import { graphql } from '$lib/api/graphql';
import { v4 } from 'uuid'


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

    return graphql({ query }, false)
  },

  // purpose:		creates a new user
  // arguments:	
  //				properties: object containing first_name, last_name, email i password
  //        returns: id of the new user
  // ------------------------------------------------------------------------
  create: async (email, password, firstName, lastName) => {
    const userQuery = `
      mutation {
        user: user_create(user: { email: "${email}", password: "${password}", properties: []}) {
          id
        }
      }
    `;
    
    return graphql({ query: userQuery }, false).then(data => {
      if (data.errors) {
        return data
      }
      const userId = data.user.id;
      const name = `${firstName} ${lastName}`;

      const names = Array.from(new Set(
        [email.toLowerCase(), firstName.toLowerCase(), lastName.toLowerCase()]
      )).join(' ');

      const profileQuery = `
        mutation {
          record: record_create(
            record: {
              table: "modules/user/profile"
              properties: [
                { name: "user_id", value: "${userId}" }
                { name: "uuid", value: "${v4()}" }
                { name: "first_name", value: "${firstName}" }
                { name: "last_name", value: "${lastName}" }
                { name: "name", value: "${name}" }
                { name: "email", value: "${email}" }
                { name: "roles", value_array: ["member"] }
                { name: "c__names", value: "${names}" }
              ]
            }
          ) {
            id
          }
      }
      `;

      return graphql({query: profileQuery }, false).then(() => userId);
    });
  },


};



// exports
// ------------------------------------------------------------------------
export { user }
