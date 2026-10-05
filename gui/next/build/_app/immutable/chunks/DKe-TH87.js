import{t as e}from"./Gy9kihEB.js";var t={get:async t=>{let n=``;t?.id&&(n=`id: { value: "${t.id}" }`);let r=``;t?.type&&(r=`type: ${t.type}`);let i=`
      query {
        admin_background_jobs(
          per_page: 20,
          page: ${t?.page||1}
          filter: {
            ${n}
            ${r}
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
      }`;return e({query:i},!1).then(e=>e.admin_background_jobs)},delete:async t=>{let n=`
      mutation {
        admin_background_job_delete(id: "${Object.fromEntries(t.properties.entries()).id}") {
          id
        }
      }
    `;return e({query:n},!1)},retry:async t=>{let n=`
      mutation {
        admin_background_job_retry(id: "${Object.fromEntries(t.properties.entries()).id}"){
          id
        }
      }
    `;return e({query:n},!1)}};export{t};