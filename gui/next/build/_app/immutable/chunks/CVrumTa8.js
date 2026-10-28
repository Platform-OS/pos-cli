import{t as e}from"./CV8CO4iU.js";var t={get:t=>e({query:`
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
      }`,variables:{per_page:100,id:t}}).then(e=>e.admin_tables.results)};export{t};