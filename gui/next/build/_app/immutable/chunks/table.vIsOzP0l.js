import{g as a}from"./graphql.vANW7X3L.js";const i={get:e=>{const t=`
      query {
        admin_tables(
          per_page: 100
          ${e?`filter: { id: { value: ${e} } }`:""}
        ) {
          results {
            id
            name
            properties {
              name
              attribute_type
            }
          }
        }
      }`;return a({query:t}).then(r=>r.admin_tables.results)}};export{i as t};
