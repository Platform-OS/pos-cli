import{n as e,r as t}from"./9O3AIQt7.js";var n=[`SCHEDULED`,`DEAD`,`RUNNING`],r={get:async(e,r)=>{let i=parseInt(e?.page)>0?parseInt(e.page):1,a=``;e?.id&&(a=`id: { value: ${JSON.stringify(String(e.id))} }`);let o=``;n.includes(e?.type)&&(o=`type: ${e.type}`);let s=`
      query {
        admin_background_jobs(
          per_page: 20,
          page: ${i}
          filter: {
            ${a}
            ${o}
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
      }`;return t({query:s},r).then(e=>e.admin_background_jobs)},delete:async t=>{let n=Object.fromEntries(t.properties.entries()).id,r=`
      mutation {
        admin_background_job_delete(id: ${JSON.stringify(String(n))}) {
          id
        }
      }
    `;return e({query:r},!1)},retry:async t=>{let n=Object.fromEntries(t.properties.entries()).id,r=`
      mutation {
        admin_background_job_retry(id: ${JSON.stringify(String(n))}){
          id
        }
      }
    `;return e({query:r},!1)},stop:async t=>{let n=Object.fromEntries(t.properties.entries()).id,r=`
      mutation {
        admin_background_job_stop(id: ${JSON.stringify(String(n))}){
          id
        }
      }
    `;return e({query:r},!1)}};export{r as t};