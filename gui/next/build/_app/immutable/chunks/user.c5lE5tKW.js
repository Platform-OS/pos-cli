import{g as n}from"./graphql.vANW7X3L.js";const i={get:e=>{let t="";e.attribute==="email"?t+=`${e.attribute}: { contains: "${e.value}" }`:t+=`${e.attribute}: { value: "${e.value}" }`;let a="";e?.attribute==="id"&&e?.value&&(a=`
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
      `);const r=`
      query {
        users(
          page: ${e?.page??1}
          per_page: 50
          sort: { id: { order: ASC } }
          filter: {
            ${t}
          }
        ) {
          current_page
          total_pages
          results {
            id
            email
            ${a}
          }
        }
      }`;return n({query:r}).then(u=>u.users)}};export{i as u};
