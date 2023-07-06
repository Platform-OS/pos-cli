import{g}from"./graphql.b64cf78b.js";const o={get:a=>{let e="";a.attribute&&a.value&&(e+=`${a.attribute}: { value: "${a.value}" }`);let t="";(a==null?void 0:a.attribute)==="id"&&(a!=null&&a.value)&&(t=`
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
      `);const u=`
      query {
        users(
          page: ${(a==null?void 0:a.page)??1}
          per_page: 50
          sort: { id: { order: ASC } }
          filter: {
            ${e}
          }
        ) {
          current_page
          total_pages
          results {
            id
            email
            ${t}
          }
        }
      }`;return g({query:u}).then(n=>n.users)}};export{o as u};
