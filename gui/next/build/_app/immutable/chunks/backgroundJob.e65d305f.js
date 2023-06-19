import{g as o}from"./graphql.b64cf78b.js";const _={get:async e=>{let r="";e!=null&&e.id&&(r=`id: { value: "${e.id}" }`);let t="";e!=null&&e.type&&(t=`type: ${e.type}`);const a=`
      query {
        admin_background_jobs(
          per_page: 100,
          filter: {
            ${r}
            ${t}
          }
        ) {
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
      }`;return o({query:a}).then(d=>d.admin_background_jobs.results)},delete:async e=>{const a=`
      mutation {
        admin_background_job_delete(id: "${Object.fromEntries(e.properties.entries()).id}") {
          id
        }
      }
    `;return o({query:a})}};export{_ as b};
