/*
  handles operations on background jobs
*/

// imports
// ------------------------------------------------------------------------
import { graphql } from '#lib/api/graphql';


// the job types the list can be filtered by, written into the query as an enum value (array)
const types = ['SCHEDULED', 'DEAD', 'RUNNING'];


const backgroundJob = {

  // purpose:		downloads background jobs list from API
  // arguments: filters to apply to query (object)
  //				options (object), with fetch to use, such as the one a load function receives
  // returns:		background jobs in json format (array of objects)
  // ------------------------------------------------------------------------
  get: async (filters, options) => {

    // these are written into the query text and can come from a url, so the type is one
    // of the known names, the page a number and the id a quoted, escaped string
    const page = parseInt(filters?.page) > 0 ? parseInt(filters.page) : 1;

    let idFilter = '';
    if(filters?.id){
      idFilter = `id: { value: ${JSON.stringify(String(filters.id))} }`;
    }

    let typeFilter = '';
    if(types.includes(filters?.type)){
      typeFilter = `type: ${filters.type}`;
    }

    const query = `
      query {
        admin_background_jobs(
          per_page: 20,
          page: ${page}
          filter: {
            ${idFilter}
            ${typeFilter}
          }
        ) {
          has_next_page,
          has_previous_page,
          total_pages,
          results {
            id
            arguments
            attempts
            created_at
            dead_at
            error
            error_class
            error_message
            failed_at
            form_configuration_name
            form_name
            id
            label
            liquid_body
            partial_name
            locked_at
            queue
            resource_id
            resource_type
            retry_at
            run_at
            source_name
            source_type
            started_at
            updated_at
          }
        }
      }`;

    return graphql({ query }, options).then(data => data.admin_background_jobs);

  },


  // purpose:		deletes a planned background job
  // arguments: id of the job to delete (string)
  // ------------------------------------------------------------------------
  delete: async (args) => {

    let properties = Object.fromEntries(args.properties.entries());
    const id = properties.id;

    const query = `
      mutation {
        admin_background_job_delete(id: ${JSON.stringify(String(id))}) {
          id
        }
      }
    `;

    return graphql({ query }, false);

  },


  // purpose:		runs the background job again
  // arguments: id of the job to run (string)
  // ------------------------------------------------------------------------
  retry: async (args) => {

    let properties = Object.fromEntries(args.properties.entries());
    const id = properties.id;

    const query = `
      mutation {
        admin_background_job_retry(id: ${JSON.stringify(String(id))}){
          id
        }
      }
    `;

    return graphql({ query }, false);

  }


};



// exports
// ------------------------------------------------------------------------
export { backgroundJob };
