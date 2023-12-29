import{g as t}from"./graphql.vANW7X3L.js";const i={get:e=>t({query:`
      query(
        $per_page: Int
        $id: ID
      ) {
        admin_tables(
          per_page: $per_page
          filter: {
            id: { value: $id }
          }
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
      }`,variables:{per_page:100,id:e}}).then(r=>r.admin_tables.results)};export{i as t};
