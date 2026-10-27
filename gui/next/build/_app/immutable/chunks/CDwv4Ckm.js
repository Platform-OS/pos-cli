import{t as e}from"./BY_WCETB.js";import{t}from"./B_bKnyWZ.js";var n={get:async(t={},n)=>{let r=t.attribute===`id`?`id`:`email`,i=parseInt(t.page)>0?parseInt(t.page):1,a=t.value?JSON.stringify(String(t.value)):``,o=``,s=``;a&&(o+=r===`email`?`email: { contains: ${a} }`:`id: { value: ${a} }`,r===`id`&&(s=`
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
        `));let c=`
      query {
        users(
          page: ${i}
          per_page: 50
          sort: { id: { order: DESC } }
          filter: {
            ${o}
          }
        ) {
          current_page
          total_pages
          results {
            id
            email
            ${s}
            properties
          }
        }
      }`;return e({query:c},n).then(e=>e.users)},delete:async t=>{let n=`
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