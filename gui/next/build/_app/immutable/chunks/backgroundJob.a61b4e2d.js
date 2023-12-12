import{g as o}from"./graphql.6ce9eb6f.js";const _={get:async e=>{let t="";e!=null&&e.id&&(t=`id: { value: "${e.id}" }`);let a="";e!=null&&e.type&&(a=`type: ${e.type}`);const r=`
      query {
        admin_background_jobs(
          per_page: 20,
          page: ${(e==null?void 0:e.page)||1}
          filter: {
            ${t}
            ${a}
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
      }`;return o({query:r}).then(d=>d.admin_background_jobs)},delete:async e=>{const r=`
      mutation {
        admin_background_job_delete(id: "${Object.fromEntries(e.properties.entries()).id}") {
          id
        }
      }
    `;return o({query:r})},retry:async e=>{const r=`
      mutation {
        admin_background_job_retry(id: "${Object.fromEntries(e.properties.entries()).id}"){
          id
        }
      }
    `;return o({query:r})}};export{_ as b};
