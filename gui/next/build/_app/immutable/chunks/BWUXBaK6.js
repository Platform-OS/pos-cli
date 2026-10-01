import{t as e}from"./DlzbzFbm.js";import{t}from"./B_bKnyWZ.js";var n={get:async(t={})=>{let n=``,r=``;t.value&&(t.attribute===`email`?n+=`${t.attribute}: { contains: "${t.value}" }`:n+=`${t.attribute}: { value: "${t.value}" }`,t?.attribute===`id`&&t?.value&&(r=`
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
        `));let i=`
      query {
        users(
          page: ${t?.page??1}
          per_page: 50
          sort: { id: { order: DESC } }
          filter: {
            ${n}
          }
        ) {
          current_page
          total_pages
          results {
            id
            email
            ${r}
            properties
          }
        }
      }`;return e({query:i},!1).then(e=>e.users)},delete:async t=>{let n=`
      mutation {
        user_delete(id: ${t}){ id }
      }
    `;return e({query:n},!1)},create:async(n,r,i)=>{let a=t(i),o=`
      mutation${a.variablesDefinition} {
        user: user_create(user: { email: "${n}", password: "${r}", properties: [${a.properties}] }) {
          id
        }
      }
    `;return e({query:o,variables:a.variables},!1)},edit:async(n,r,i)=>{let a=t(i),o=`
      mutation${a.variablesDefinition} {
        user_update(user: { email: "${r}",  properties: [${a.properties}] }, id: ${n}) {
          id
        }
      }
    `;return e({query:o,variables:a.variables},!1)},getCustomProperties:async()=>e({query:`
      query {
        admin_user_schema {
          properties {
            attribute_type
            name
          }
        }
      }
    `},!1).then(e=>e.admin_user_schema.properties)};export{n as t};